const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Docker container name for docker-mailserver
const DOCKER_CONTAINER = process.env.DOCKER_CONTAINER || 'mailserver';

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
    await execSetup(`email add ${email} ${password}`);
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
    await execSetup(`email update ${email} ${password}`);
    debugLog(`Password updated for account: ${email}`);
    return { success: true, email };
  } catch (error) {
    console.error('Error updating account password:', error);
    debugLog('Account password update error:', error);
    throw new Error('Unable to update email account password');
  }
}

// Function to delete an email account
async function deleteAccount(email) {
  try {
    debugLog(`Deleting email account: ${email}`);
    await execSetup(`email del ${email}`);
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
    await execSetup(`alias add ${source} ${destination}`);
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
    await execSetup(`alias del ${source} ${destination}`);
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
  deleteAccount,
  getAliases,
  addAlias,
  deleteAlias,
  getServerStatus,
};
