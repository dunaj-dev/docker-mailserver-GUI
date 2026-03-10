const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const dockerMailserver = require('./dockerMailserver');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Docker Mailserver GUI API',
      version: '1.0.0',
      description: 'API for Docker Mailserver GUI',
    },
  },
  apis: ['./*.js'], // files containing annotations as above
};

const specs = swaggerJsdoc(options);

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
/**
 * @swagger
 * /api/status:
 *   get:
 *     summary: Get server status
 *     description: Retrieve the status of the docker-mailserver
 *     responses:
 *       200:
 *         description: Server status
 *       500:
 *         description: Unable to connect to docker-mailserver
 */
app.get('/api/status', async (req, res) => {
  try {
    const status = await dockerMailserver.getServerStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Unable to connect to docker-mailserver' });
  }
});

// Endpoint for retrieving email accounts
/**
 * @swagger
 * /api/accounts:
 *   get:
 *     summary: Get email accounts
 *     description: Retrieve all email accounts
 *     responses:
 *       200:
 *         description: List of email accounts
 *       500:
 *         description: Unable to retrieve accounts
 */
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await dockerMailserver.getAccounts();
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: 'Unable to retrieve accounts' });
  }
});

// Endpoint for adding a new email account
/**
 * @swagger
 * /api/accounts:
 *   post:
 *     summary: Add a new email account
 *     description: Add a new email account to the docker-mailserver
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email address of the new account
 *               password:
 *                 type: string
 *                 description: Password for the new account
 *     responses:
 *       201:
 *         description: Account created successfully
 *       400:
 *         description: Email and password are required
 *       500:
 *         description: Unable to create account
 */
app.post('/api/accounts', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const result = await dockerMailserver.addAccount(email, password);
    res.status(201).json({ message: 'Account created successfully', email });
  } catch (error) {
    res.status(500).json({ error: 'Unable to create account' });
  }
});

// Endpoint for deleting an email account
/**
 * @swagger
 * /api/accounts/{email}:
 *   delete:
 *     summary: Delete an email account
 *     description: Delete an email account from the docker-mailserver
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Email address of the account to delete
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       400:
 *         description: Email is required
 *       500:
 *         description: Unable to delete account
 */
app.delete('/api/accounts/:email', async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    await dockerMailserver.deleteAccount(email);
    res.json({ message: 'Account deleted successfully', email });
  } catch (error) {
    res.status(500).json({ error: 'Unable to delete account' });
  }
});

// Endpoint for updating an email account password
/**
 * @swagger
 * /api/accounts/{email}/password:
 *   put:
 *     summary: Update an email account password
 *     description: Update the password for an existing email account
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Email address of the account to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: New password for the account
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Email and password are required
 *       500:
 *         description: Unable to update password
 */
app.put('/api/accounts/:email/password', async (req, res) => {
  try {
    const { email } = req.params;
    const { password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    await dockerMailserver.updateAccountPassword(email, password);
    res.json({ message: 'Password updated successfully', email });
  } catch (error) {
    res.status(500).json({ error: 'Unable to update password' });
  }
});

// Endpoint for retrieving aliases
/**
 * @swagger
 * /api/aliases:
 *   get:
 *     summary: Get aliases
 *     description: Retrieve all email aliases
 *     responses:
 *       200:
 *         description: List of email aliases
 *       500:
 *         description: Unable to retrieve aliases
 */
app.get('/api/aliases', async (req, res) => {
  try {
    const aliases = await dockerMailserver.getAliases();
    res.json(aliases);
  } catch (error) {
    res.status(500).json({ error: 'Unable to retrieve aliases' });
  }
});

// Endpoint for adding an alias
/**
 * @swagger
 * /api/aliases:
 *   post:
 *     summary: Add a new alias
 *     description: Add a new email alias to the docker-mailserver
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               source:
 *                 type: string
 *                 description: Source email address for the alias
 *               destination:
 *                 type: string
 *                 description: Destination email address for the alias
 *     responses:
 *       201:
 *         description: Alias created successfully
 *       400:
 *         description: Source and destination are required
 *       500:
 *         description: Unable to create alias
 */
app.post('/api/aliases', async (req, res) => {
  try {
    const { source, destination } = req.body;
    if (!source || !destination) {
      return res
        .status(400)
        .json({ error: 'Source and destination are required' });
    }
    await dockerMailserver.addAlias(source, destination);
    res
      .status(201)
      .json({ message: 'Alias created successfully', source, destination });
  } catch (error) {
    res.status(500).json({ error: 'Unable to create alias' });
  }
});

// Endpoint for deleting an alias
/**
 * @swagger
 * /api/aliases/{source}/{destination}:
 *   delete:
 *     summary: Delete an alias
 *     description: Delete an email alias from the docker-mailserver
 *     parameters:
 *       - in: path
 *         name: source
 *         required: true
 *         schema:
 *           type: string
 *         description: Source email address of the alias to delete
 *       - in: path
 *         name: destination
 *         required: true
 *         schema:
 *           type: string
 *         description: Destination email address of the alias to delete
 *     responses:
 *       200:
 *         description: Alias deleted successfully
 *       400:
 *         description: Source and destination are required
 *       500:
 *         description: Unable to delete alias
 */
app.delete('/api/aliases/:source/:destination', async (req, res) => {
  try {
    const { source, destination } = req.params;
    if (!source) {
      return res.status(400).json({ error: 'Source is required' });
    }

    if (!destination) {
      return res.status(400).json({ error: 'Destination is required' });
    }
    await dockerMailserver.deleteAlias(source, destination);
    res.json({ message: 'Alias deleted successfully', source, destination });
  } catch (error) {
    res.status(500).json({ error: 'Unable to delete alias' });
  }
});

// Endpoint for retrieving domains overview
/**
 * @swagger
 * /api/domains:
 *   get:
 *     summary: Get domains overview
 *     description: Retrieve all domains with DKIM/SPF/DMARC DNS guidance
 *     responses:
 *       200:
 *         description: List of domains and DNS records
 *       500:
 *         description: Unable to retrieve domains overview
 */
app.get('/api/domains', async (req, res) => {
  try {
    const domains = await dockerMailserver.getDomainsOverview();
    res.json(domains);
  } catch (error) {
    res.status(500).json({ error: 'Unable to retrieve domains overview' });
  }
});

// Endpoint for generating DKIM keys
/**
 * @swagger
 * /api/domains/dkim:
 *   post:
 *     summary: Configure DKIM
 *     description: Run `setup config dkim` inside docker-mailserver container
 *     responses:
 *       200:
 *         description: DKIM configuration command executed
 *       500:
 *         description: Unable to configure DKIM
 */
app.post('/api/domains/dkim', async (req, res) => {
  try {
    await dockerMailserver.configureDkim();
    res.json({ message: 'DKIM configuration command executed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Unable to configure DKIM' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Log debug status
  if (process.env.DEBUG_DOCKER === 'true') {
    console.log('🐞 Docker debug mode is ENABLED');
  }
});
