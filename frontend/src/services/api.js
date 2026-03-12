import axios from 'axios';

// Fallback to '/api' if environment variable is not available
const API_URL =
  (typeof process !== 'undefined' &&
    process.env &&
    process.env.REACT_APP_API_URL) ||
  '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Server status API
export const getServerStatus = async () => {
  try {
    const response = await api.get('/status');
    return response.data;
  } catch (error) {
    console.error('Error fetching server status:', error);
    throw error;
  }
};

// API dla kont email
export const getAccounts = async () => {
  try {
    const response = await api.get('/accounts');
    return response.data;
  } catch (error) {
    console.error('Error fetching accounts:', error);
    throw error;
  }
};

export const addAccount = async (email, password) => {
  try {
    const response = await api.post('/accounts', { email, password });
    return response.data;
  } catch (error) {
    console.error('Error adding account:', error);
    throw error;
  }
};

export const deleteAccount = async (email) => {
  try {
    const response = await api.delete(`/accounts/${email}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
};

export const updateAccountPassword = async (email, password) => {
  try {
    const response = await api.put(`/accounts/${email}/password`, { password });
    return response.data;
  } catch (error) {
    console.error('Error updating account password:', error);
    throw error;
  }
};

export const updateAccountQuota = async (email, quota) => {
  try {
    const response = await api.put(`/accounts/${email}/quota`, { quota });
    return response.data;
  } catch (error) {
    console.error('Error updating account quota:', error);
    throw error;
  }
};

// API dla aliasów
export const getAliases = async () => {
  try {
    const response = await api.get('/aliases');
    return response.data;
  } catch (error) {
    console.error('Error fetching aliases:', error);
    throw error;
  }
};

export const addAlias = async (source, destination) => {
  try {
    const response = await api.post('/aliases', { source, destination });
    return response.data;
  } catch (error) {
    console.error('Error adding alias:', error);
    throw error;
  }
};

export const deleteAlias = async (source, destination) => {
  try {
    const response = await api.delete(`/aliases/${source}/${destination}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting alias:', error);
    throw error;
  }
};

export const getDomains = async () => {
  try {
    const response = await api.get('/domains');
    return response.data;
  } catch (error) {
    console.error('Error fetching domains overview:', error);
    throw error;
  }
};

export const configureDkim = async () => {
  try {
    const response = await api.post('/domains/dkim');
    return response.data;
  } catch (error) {
    console.error('Error configuring DKIM:', error);
    throw error;
  }
};

export default api;
