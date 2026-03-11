const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Docker container name for docker-mailserver
const DOCKER_CONTAINER = process.env.DOCKER_CONTAINER || 'mailserver';
const OPENDKIM_KEYS_PATH =
  process.env.OPENDKIM_KEYS_PATH || '/tmp/docker-mailserver/opendkim/keys';

// Debug flag
const DEBUG = process.env.DEBUG_DOCKER === 'true';

/**
 * Debug logger that only logs if DEBUG is true
 * @param {string} message - Message to log
 * @param {any} data - Optional data to log
 */
function debugLog(message, data = null) {
  if (DEBUG) {
    if (data) {
      console.log(`[DOCKER-DEBUG] ${message}`, data);
    } else {
      console.log(`[DOCKER-DEBUG] ${message}`);
    }
  }
}

/**
 * Escapes a string for safe use in shell commands by wrapping it in single quotes
 * and escaping any single quotes within the string
 * @param {string} arg - Argument to escape
 * @return {string} Escaped argument safe for shell execution
 */
function escapeShellArg(arg) {
  // Replace single quotes with '\'' (end quote, escaped quote, start quote)
  // Then wrap the entire string in single quotes
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Normalizes a domain to lowercase and trims surrounding whitespace.
 * @param {string} domain - Domain candidate
 * @return {string|null} Normalized domain or null if invalid
 */
function normalizeDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return null;
  }

  const normalized = domain.trim().toLowerCase();
  if (!normalized || !/^[a-z0-9.-]+$/.test(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Extracts a domain from an email address.
 * @param {string} email - Email address
 * @return {string|null} Extracted domain or null when invalid
 */
function extractDomainFromEmail(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const parts = email.trim().split('@');
  if (parts.length !== 2 || !parts[1]) {
    return null;
  }

  return normalizeDomain(parts[1]);
}

/**
 * Executes a command in the docker-mailserver container
 * @param {string} command Command to execute
 * @return {Promise<string>} stdout from the command
 */
async function execInContainer(command) {
  try {
    debugLog(`Executing command in container ${DOCKER_CONTAINER}: ${command}`);

    // Get container instance
    const container = docker.getContainer(DOCKER_CONTAINER);

    // Create exec instance
    const exec = await container.exec({
      Cmd: ['sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
    });

    // Start exec instance
    const stream = await exec.start();

    // Collect output
    return new Promise((resolve, reject) => {
      let stdoutData = '';
      let stderrData = '';

      stream.on('data', (chunk) => {
        // Docker multiplexes stdout/stderr in the same stream
        // First 8 bytes contain header, actual data starts at 8th byte
        stdoutData += chunk.slice(8).toString();
      });

      stream.on('end', () => {
        debugLog(`Command completed. Output:`, stdoutData);
        resolve(stdoutData);
      });

      stream.on('error', (err) => {
        debugLog(`Command error:`, err);
        reject(err);
      });
    });
  } catch (error) {
    console.error(`Error executing command in container: ${command}`, error);
    debugLog(`Execution error:`, error);
    throw error;
  }
}

/**
 * Executes a setup.sh command in the docker-mailserver container
 * @param {string} setupCommand Command to pass to setup.sh
 * @return {Promise<string>} stdout from the command
 */
async function execSetup(setupCommand) {
  // The setup.sh script is usually located at /usr/local/bin/setup.sh or /usr/local/bin/setup in docker-mailserver
  debugLog(`Executing setup command: ${setupCommand}`);
  return execInContainer(`/usr/local/bin/setup ${setupCommand}`);
}

/**
 * Reads immediate child directories in OPENDKIM keys path (domain folders).
 * @return {Promise<string[]>} Domain names discovered from folder structure
 */
async function getDomainsFromOpendkimKeysPath() {
  const escapedPath = escapeShellArg(OPENDKIM_KEYS_PATH);
  const stdout = await execInContainer(
    `if [ -d ${escapedPath} ]; then ls -1 ${escapedPath}; fi`
  );

  return stdout
    .split('\n')
    .map((line) => line.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim())
    .filter((line) => line.length > 0)
    .map((line) => normalizeDomain(line))
    .filter(Boolean);
}

/**
 * Parses OpenDKIM TXT file content and extracts DNS-ready fields.
 * @param {string} rawDkimTxt - Raw content of mail.txt
 * @return {{recordName: string, recordType: string, recordValue: string, raw: string}}
 */
function parseDkimTxt(rawDkimTxt) {
  const cleanedRaw = rawDkimTxt
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const nameMatch = cleanedRaw.match(/^([^\s]+)\s+IN\s+TXT/i);
  const recordName = nameMatch ? nameMatch[1] : 'mail._domainkey';

  const quotedParts = [...cleanedRaw.matchAll(/"([^"]+)"/g)].map(
    (match) => match[1]
  );
  const recordValue = quotedParts.join('').replace(/\s+/g, ' ').trim();

  return {
    recordName,
    recordType: 'TXT',
    recordValue,
    raw: cleanedRaw,
  };
}

/**
 * Reads DKIM TXT record from mail.txt for a specific domain.
 * @param {string} domain - Domain name
 * @return {Promise<{configured: boolean, selector: string, recordName: string|null, recordType: string, recordValue: string|null, raw: string|null}>}
 */
async function getDomainDkim(domain) {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return {
      configured: false,
      selector: 'mail',
      recordName: null,
      recordType: 'TXT',
      recordValue: null,
      raw: null,
    };
  }

  const dkimFilePath = `${OPENDKIM_KEYS_PATH}/${normalizedDomain}/mail.txt`;
  const escapedFilePath = escapeShellArg(dkimFilePath);
  const stdout = await execInContainer(
    `if [ -f ${escapedFilePath} ]; then cat ${escapedFilePath}; fi`
  );

  const rawDkimTxt = stdout.trim();
  if (!rawDkimTxt) {
    return {
      configured: false,
      selector: 'mail',
      recordName: null,
      recordType: 'TXT',
      recordValue: null,
      raw: null,
    };
  }

  const parsed = parseDkimTxt(rawDkimTxt);
  return {
    configured: true,
    selector: 'mail',
    recordName: parsed.recordName,
    recordType: parsed.recordType,
    recordValue: parsed.recordValue,
    raw: parsed.raw,
  };
}

/**
 * Returns domain overview with DKIM, SPF, and DMARC DNS data.
 * @return {Promise<Array>} Domain overview list
 */
async function getDomainsOverview() {
  try {
    const [accounts, aliases, keyPathDomains] = await Promise.all([
      getAccounts(),
      getAliases(),
      getDomainsFromOpendkimKeysPath(),
    ]);

    const domainsSet = new Set();

    accounts.forEach((account) => {
      const domain = extractDomainFromEmail(account.email);
      if (domain) {
        domainsSet.add(domain);
      }
    });

    aliases.forEach((alias) => {
      const sourceDomain = extractDomainFromEmail(alias.source);
      const destinationDomain = extractDomainFromEmail(alias.destination);
      if (sourceDomain) {
        domainsSet.add(sourceDomain);
      }
      if (destinationDomain) {
        domainsSet.add(destinationDomain);
      }
    });

    keyPathDomains.forEach((domain) => domainsSet.add(domain));

    const domains = Array.from(domainsSet).sort((a, b) => a.localeCompare(b));
    const domainsWithDns = await Promise.all(
      domains.map(async (domain) => {
        const dkim = await getDomainDkim(domain);

        return {
          domain,
          dkim,
          spf: {
            recordName: '@',
            recordType: 'TXT',
            recordValue: 'v=spf1 mx -all',
            explanation:
              'Allow mail delivery from this domain hosts (mx) and reject other senders.',
          },
          dmarc: {
            recordName: `_dmarc.${domain}`,
            recordType: 'TXT',
            recordValue: `v=DMARC1; p=none; rua=mailto:postmaster@${domain}; fo=1; adkim=s; aspf=s`,
            explanation:
              'Start with p=none for monitoring, then tighten policy to quarantine or reject after validation.',
          },
        };
      })
    );

    return domainsWithDns;
  } catch (error) {
    console.error('Error retrieving domains overview:', error);
    debugLog('Domains overview error:', error);
    throw new Error('Unable to retrieve domains overview');
  }
}

/**
 * Runs docker-mailserver DKIM configuration command.
 * @return {Promise<{success: boolean, command: string}>}
 */
async function configureDkim() {
  try {
    await execSetup('config dkim');
    return {
      success: true,
      command: 'setup config dkim',
    };
  } catch (error) {
    console.error('Error configuring DKIM:', error);
    debugLog('DKIM configuration error:', error);
    throw new Error('Unable to configure DKIM');
  }
}

// Function to retrieve email accounts
async function getAccounts() {
  try {
    debugLog('Getting email accounts list');
    const stdout = await execSetup('email list');

    // Parse multiline output with regex to extract email and size information
    const accounts = [];
    const accountLineRegex =
      /\* ([\w\-\.@]+) \( ([\w\.\~]+) \/ ([\w\.\~]+) \) \[(\d+)%\](.*)$/;

    // Process each line individually
    const lines = stdout.split('\n').filter((line) => line.trim().length > 0);
    debugLog('Raw email list response:', lines);

    for (let i = 0; i < lines.length; i++) {
      // Clean the line from binary control characters
      const line = lines[i].replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();

      // Check if line contains * which indicates an account entry
      if (line.includes('*')) {
        const match = line.match(accountLineRegex);

        if (match) {
          const email = match[1];
          const usedSpace = match[2];
          const totalSpace = match[3] === '~' ? 'unlimited' : match[3];
          const usagePercent = match[4];

          debugLog(
            `Parsed account: ${email}, Storage: ${usedSpace}/${totalSpace} [${usagePercent}%]`
          );

          accounts.push({
            email,
            storage: {
              used: usedSpace,
              total: totalSpace,
              percent: usagePercent + '%',
            },
          });
        } else {
          debugLog(`Failed to parse account line: ${line}`);
        }
      }
    }

    debugLog(`Found ${accounts.length} accounts`);
    return accounts;
  } catch (error) {
    console.error('Error retrieving accounts:', error);
    debugLog('Account retrieval error:', error);
    throw new Error('Unable to retrieve account list');
  }
}

// Function to add a new email account
async function addAccount(email, password) {
  try {
    debugLog(`Adding new email account: ${email}`);
    await execSetup(
      `email add ${escapeShellArg(email)} ${escapeShellArg(password)}`
    );
    debugLog(`Account created: ${email}`);
    return { success: true, email };
  } catch (error) {
    console.error('Error adding account:', error);
    debugLog('Account creation error:', error);
    throw new Error('Unable to add email account');
  }
}

// Function to update an email account password
async function updateAccountPassword(email, password) {
  try {
    debugLog(`Updating password for account: ${email}`);
    await execSetup(
      `email update ${escapeShellArg(email)} ${escapeShellArg(password)}`
    );
    debugLog(`Password updated for account: ${email}`);
    return { success: true, email };
  } catch (error) {
    console.error('Error updating account password:', error);
    debugLog('Account password update error:', error);
    throw new Error('Unable to update email account password');
  }
}

// Function to update an email account quota
async function updateAccountQuota(email, quota) {
  try {
    debugLog(`Updating quota for account: ${email} -> ${quota}`);
    await execSetup(
      `email update ${escapeShellArg(email)} --quota ${escapeShellArg(quota)}`
    );
    debugLog(`Quota updated for account: ${email}`);
    return { success: true, email, quota };
  } catch (error) {
    console.error('Error updating account quota:', error);
    debugLog('Account quota update error:', error);
    throw new Error('Unable to update email account quota');
  }
}

// Function to delete an email account
async function deleteAccount(email) {
  try {
    debugLog(`Deleting email account: ${email}`);
    await execSetup(`email del ${escapeShellArg(email)}`);
    debugLog(`Account deleted: ${email}`);
    return { success: true, email };
  } catch (error) {
    console.error('Error deleting account:', error);
    debugLog('Account deletion error:', error);
    throw new Error('Unable to delete email account');
  }
}

// Function to retrieve aliases
async function getAliases() {
  try {
    debugLog('Getting aliases list');
    const stdout = await execSetup('alias list');
    const aliases = [];

    // Parse each line in the format "* source destination"
    const lines = stdout.split('\n').filter((line) => line.trim().length > 0);
    debugLog('Raw alias list response:', lines);

    // Modified regex to be more tolerant of control characters that might appear in the output
    const aliasRegex = /\* ([\w\-\.@]+) ([\w\-\.@]+)$/;

    for (let i = 0; i < lines.length; i++) {
      // Clean the line from binary control characters
      const line = lines[i].replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();

      if (line.includes('*')) {
        const match = line.match(aliasRegex);
        if (match) {
          const source = match[1];
          const destination = match[2];
          debugLog(`Parsed alias: ${source} -> ${destination}`);

          aliases.push({
            source,
            destination,
          });
        } else {
          debugLog(`Failed to parse alias line: ${line}`);
        }
      }
    }

    debugLog(`Found ${aliases.length} aliases`);
    return aliases;
  } catch (error) {
    console.error('Error retrieving aliases:', error);
    debugLog('Alias retrieval error:', error);
    throw new Error('Unable to retrieve alias list');
  }
}

// Function to add an alias
async function addAlias(source, destination) {
  try {
    debugLog(`Adding new alias: ${source} -> ${destination}`);
    await execSetup(
      `alias add ${escapeShellArg(source)} ${escapeShellArg(destination)}`
    );
    debugLog(`Alias created: ${source} -> ${destination}`);
    return { success: true, source, destination };
  } catch (error) {
    console.error('Error adding alias:', error);
    debugLog('Alias creation error:', error);
    throw new Error('Unable to add alias');
  }
}

// Function to delete an alias
async function deleteAlias(source, destination) {
  try {
    debugLog(`Deleting alias: ${source} => ${destination}`);
    await execSetup(
      `alias del ${escapeShellArg(source)} ${escapeShellArg(destination)}`
    );
    debugLog(`Alias deleted: ${source} => ${destination}`);
    return { success: true, source, destination };
  } catch (error) {
    console.error('Error deleting alias:', error);
    debugLog('Alias deletion error:', error);
    throw new Error('Unable to delete alias');
  }
}

// Function to check server status
async function getServerStatus() {
  try {
    debugLog('Getting server status');

    // Get container info
    const container = docker.getContainer(DOCKER_CONTAINER);
    const containerInfo = await container.inspect();

    // Check if container is running
    const isRunning = containerInfo.State.Running === true;
    debugLog(`Container running: ${isRunning}`);

    let diskUsage = '0%';
    let cpuUsage = '0%';
    let memoryUsage = '0MB';

    if (isRunning) {
      // Get container stats
      debugLog('Getting container stats');
      const stats = await container.stats({ stream: false });

      // Calculate CPU usage percentage
      const cpuDelta =
        stats.cpu_stats.cpu_usage.total_usage -
        stats.precpu_stats.cpu_usage.total_usage;
      const systemCpuDelta =
        stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent =
        (cpuDelta / systemCpuDelta) * stats.cpu_stats.online_cpus * 100;
      cpuUsage = `${cpuPercent.toFixed(2)}%`;

      // Calculate memory usage
      const memoryUsageBytes = stats.memory_stats.usage;
      memoryUsage = formatMemorySize(memoryUsageBytes);

      debugLog(`Resources - CPU: ${cpuUsage}, Memory: ${memoryUsage}`);

      // For disk usage, we would need to run a command inside the container
      // This could be a more complex operation involving checking specific directories
      // For simplicity, we'll set this to "N/A" or implement a basic check
      diskUsage = 'N/A';
    }

    const result = {
      status: isRunning ? 'running' : 'stopped',
      resources: {
        cpu: cpuUsage,
        memory: memoryUsage,
        disk: diskUsage,
      },
    };

    debugLog('Server status result:', result);
    return result;
  } catch (error) {
    console.error('Error checking server status:', error);
    debugLog('Server status error:', error);
    return {
      status: 'unknown',
      error: error.message,
    };
  }
}

// Helper function to format memory size
function formatMemorySize(bytes) {
  if (bytes === 0) return '0B';

  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + sizes[i];
}

module.exports = {
  getAccounts,
  addAccount,
  updateAccountPassword,
  updateAccountQuota,
  deleteAccount,
  getAliases,
  addAlias,
  deleteAlias,
  getDomainsOverview,
  configureDkim,
  getServerStatus,
};
