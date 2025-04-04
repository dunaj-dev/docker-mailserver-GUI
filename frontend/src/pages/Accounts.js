import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAccounts,
  addAccount,
  deleteAccount,
  updateAccountPassword,
} from '../services/api';
import {
  AlertMessage,
  Button,
  Card,
  DataTable,
  FormField,
  LoadingSpinner,
} from '../components';
import { useRef } from 'react';
import Row from 'react-bootstrap/Row'; // Import Row
import Col from 'react-bootstrap/Col'; // Import Col
import Modal from 'react-bootstrap/Modal'; // Import Modal
import ProgressBar from 'react-bootstrap/ProgressBar'; // Import ProgressBar

const Accounts = () => {
  const passwordFormRef = useRef(null);
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // State for password change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [passwordFormData, setPasswordFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordFormErrors, setPasswordFormErrors] = useState({});

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const data = await getAccounts();
      setAccounts(data);
      setError(null);
    } catch (err) {
      console.error(t('api.errors.fetchAccounts'), err);
      setError('api.errors.fetchAccounts');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear the error for this field while typing
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: null,
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.email.trim()) {
      errors.email = 'accounts.emailRequired';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'accounts.invalidEmail';
    }

    if (!formData.password) {
      errors.password = 'accounts.passwordRequired';
    } else if (formData.password.length < 8) {
      errors.password = 'accounts.passwordLength';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'accounts.passwordsNotMatch';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');

    if (!validateForm()) {
      return;
    }

    try {
      await addAccount(formData.email, formData.password);
      setSuccessMessage('accounts.accountCreated');
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
      });
      fetchAccounts(); // Refresh the accounts list
    } catch (err) {
      console.error(t('api.errors.addAccount'), err);
      setError('api.errors.addAccount');
    }
  };

  const handleDelete = async (email) => {
    if (window.confirm(t('accounts.confirmDelete', { email }))) {
      try {
        await deleteAccount(email);
        setSuccessMessage('accounts.accountDeleted');
        fetchAccounts(); // Refresh the accounts list
      } catch (err) {
        console.error(t('api.errors.deleteAccount'), err);
        setError('api.errors.deleteAccount');
      }
    }
  };

  // Open password change modal for an account
  const handleChangePassword = (account) => {
    setSelectedAccount(account);
    setPasswordFormData({
      newPassword: '',
      confirmPassword: '',
    });
    setPasswordFormErrors({});
    setShowPasswordModal(true);
  };

  // Close password change modal
  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setSelectedAccount(null);
  };

  // Handle input changes for password change form
  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target;
    setPasswordFormData({
      ...passwordFormData,
      [name]: value,
    });

    // Clear the error for this field while typing
    if (passwordFormErrors[name]) {
      setPasswordFormErrors({
        ...passwordFormErrors,
        [name]: null,
      });
    }
  };

  // Validate password change form
  const validatePasswordForm = () => {
    const errors = {};

    if (!passwordFormData.newPassword) {
      errors.newPassword = 'accounts.passwordRequired';
    } else if (passwordFormData.newPassword.length < 8) {
      errors.newPassword = 'accounts.passwordLength';
    }

    if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
      errors.confirmPassword = 'accounts.passwordsNotMatch';
    }

    setPasswordFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit password change
  const handleSubmitPasswordChange = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage('');

    if (!validatePasswordForm()) {
      return;
    }

    try {
      await updateAccountPassword(
        selectedAccount.email,
        passwordFormData.newPassword
      );
      setSuccessMessage('accounts.passwordUpdated');
      handleClosePasswordModal(); // Close the modal
    } catch (err) {
      console.error(t('api.errors.updatePassword'), err);
      setError('api.errors.updatePassword');
    }
  };

  // Column definitions for accounts table
  const columns = [
    { key: 'email', label: 'accounts.email' },
    {
      key: 'storage',
      label: 'accounts.storage',
      render: (account) =>
        account.storage ? (
          <div>
            <div>
              {account.storage.used} / {account.storage.total}
            </div>
            {/* Use ProgressBar component */}
            <ProgressBar
              now={parseInt(account.storage.percent)}
              style={{ height: '5px' }}
              className="mt-1"
            />
          </div>
        ) : (
          'N/A'
        ),
    },
    {
      key: 'actions',
      label: 'accounts.actions',
      render: (account) => (
        <div className="d-flex">
          <Button
            variant="primary"
            size="sm"
            icon="key"
            title={t('accounts.changePassword')}
            onClick={() => handleChangePassword(account)}
            className="me-2"
          />
          <Button
            variant="danger"
            size="sm"
            icon="trash"
            title={t('accounts.confirmDelete', { email: account.email })}
            onClick={() => handleDelete(account.email)}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2 className="mb-4">{t('accounts.title')}</h2>
      <AlertMessage type="danger" message={error} />
      <AlertMessage type="success" message={successMessage} />
      <Row>
        {' '}
        {/* Use Row component */}
        <Col md={6} className="mb-4">
          {' '}
          {/* Use Col component */}
          <Card title="accounts.newAccount">
            {' '}
            {/* Removed mb-4 from Card, added to Col */}
            <form onSubmit={handleSubmit} className="form-wrapper">
              <FormField
                type="email"
                id="email"
                name="email"
                label="accounts.email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="user@domain.com"
                error={formErrors.email}
                required
              />

              <FormField
                type="password"
                id="password"
                name="password"
                label="accounts.password"
                value={formData.password}
                onChange={handleInputChange}
                error={formErrors.password}
                required
              />

              <FormField
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                label="accounts.confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                error={formErrors.confirmPassword}
                required
              />

              <Button
                type="submit"
                variant="primary"
                text="accounts.addAccount"
              />
            </form>
          </Card>
        </Col>{' '}
        {/* Close first Col */}
        <Col md={6}>
          {' '}
          {/* Use Col component */}
          <Card title="accounts.existingAccounts">
            <DataTable
              columns={columns}
              data={accounts}
              keyExtractor={(account) => account.email}
              loading={loading}
              emptyMessage="accounts.noAccounts"
            />
          </Card>
        </Col>{' '}
        {/* Close second Col */}
      </Row>{' '}
      {/* Close Row */}
      {/* Password Change Modal using react-bootstrap */}
      <Modal show={showPasswordModal} onHide={handleClosePasswordModal}>
        <Modal.Header closeButton>
          <Modal.Title>
            {t('accounts.changePassword')} - {selectedAccount?.email}{' '}
            {/* Use optional chaining */}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedAccount && ( // Ensure selectedAccount exists before rendering form
            <form onSubmit={handleSubmitPasswordChange} ref={passwordFormRef}>
              <FormField
                type="password"
                id="newPassword"
                name="newPassword"
                label="accounts.newPassword"
                value={passwordFormData.newPassword}
                onChange={handlePasswordInputChange}
                error={passwordFormErrors.newPassword}
                required
              />

              <FormField
                type="password"
                id="confirmPasswordModal"
                name="confirmPassword"
                label="accounts.confirmPassword"
                value={passwordFormData.confirmPassword}
                onChange={handlePasswordInputChange}
                error={passwordFormErrors.confirmPassword}
                required
              />
            </form>
          )}
        </Modal.Body>
        <Modal.Footer>
          {/* Use refactored Button component */}
          <Button
            variant="secondary"
            onClick={handleClosePasswordModal}
            text="common.cancel"
          />
          <Button
            variant="primary"
            onClick={handleSubmitPasswordChange}
            text="accounts.updatePassword"
          />
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Accounts;
