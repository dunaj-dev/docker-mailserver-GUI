import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configureDkim, getDomains } from '../services/api';
import {
  AlertMessage,
  Button,
  Card,
  DataTable,
  LoadingSpinner,
} from '../components';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Badge from 'react-bootstrap/Badge';
import Modal from 'react-bootstrap/Modal';

const Domains = () => {
  const { t } = useTranslation();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [dkimGenerating, setDkimGenerating] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(null);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState(null);

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      setLoading(true);
      const data = await getDomains();
      setDomains(data);
      setError(null);
    } catch (err) {
      console.error(t('api.errors.fetchDomains'), err);
      setError('api.errors.fetchDomains');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureDkim = async () => {
    try {
      setError(null);
      setSuccessMessage('');
      setDkimGenerating(true);
      await configureDkim();
      setSuccessMessage('domains.dkimConfigured');
      await fetchDomains();
    } catch (err) {
      console.error(t('api.errors.configureDkim'), err);
      setError('api.errors.configureDkim');
    } finally {
      setDkimGenerating(false);
    }
  };

  const handleCopyDkim = async (domain, recordValue) => {
    if (!recordValue) {
      return;
    }

    try {
      // Clipboard API requires a secure context (HTTPS/localhost).
      // Fallback for HTTP/self-hosted deployments.
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(recordValue);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = recordValue;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();

        const copied = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (!copied) {
          throw new Error('Fallback copy command failed');
        }
      }

      setCopiedDomain(domain);
      setTimeout(() => {
        setCopiedDomain(null);
      }, 2000);
    } catch (err) {
      console.error(t('api.errors.copyDkim'), err);
      setError('api.errors.copyDkim');
    }
  };

  const columns = [
    {
      key: 'domain',
      label: 'domains.domain',
      render: (item) => <strong>{item.domain}</strong>,
    },
    {
      key: 'dkim',
      label: 'domains.dkim',
      render: (item) =>
        item.dkim.configured ? (
          <Badge bg="success">{t('domains.configured')}</Badge>
        ) : (
          <Badge bg="warning" text="dark">
            {t('domains.notConfigured')}
          </Badge>
        ),
    },
    {
      key: 'dkimRecord',
      label: 'domains.dkimRecord',
      render: (item) =>
        item.dkim.configured ? (
          <div>
            <div className="small text-muted mb-1">
              {item.dkim.recordName} {item.dkim.recordType}
            </div>
            <code className="small text-break d-block">
              {item.dkim.recordValue}
            </code>
          </div>
        ) : (
          <span className="text-muted">{t('domains.noDkimYet')}</span>
        ),
    },
    {
      key: 'actions',
      label: 'accounts.actions',
      render: (item) => (
        <div className="d-flex gap-2">
          <Button
            variant="outline-dark"
            size="sm"
            icon="book"
            text="domains.openDnsGuide"
            onClick={() => {
              setSelectedDomain(item);
              setShowGuideModal(true);
            }}
          />
          <Button
            variant="outline-primary"
            size="sm"
            icon="gear-fill"
            text="domains.generateDkim"
            onClick={handleConfigureDkim}
            disabled={dkimGenerating}
          />
          <Button
            variant="outline-secondary"
            size="sm"
            icon={copiedDomain === item.domain ? 'check2' : 'clipboard'}
            text={
              copiedDomain === item.domain
                ? 'domains.copied'
                : 'domains.copyDkim'
            }
            onClick={() => handleCopyDkim(item.domain, item.dkim.recordValue)}
            disabled={!item.dkim.configured}
          />
        </div>
      ),
    },
  ];

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <h2 className="mb-4">{t('domains.title')}</h2>
      <AlertMessage type="danger" message={error} />
      <AlertMessage type="success" message={successMessage} />

      <Row>
        <Col md={12}>
          <Card
            title="domains.overview"
            headerContent={
              <div className="ms-auto">
                <Button
                  variant="primary"
                  size="sm"
                  icon="arrow-clockwise"
                  text="domains.refresh"
                  onClick={fetchDomains}
                  className="me-2"
                  disabled={loading || dkimGenerating}
                />
                <Button
                  variant="success"
                  size="sm"
                  icon="shield-lock"
                  text="domains.generateMissingDkim"
                  onClick={handleConfigureDkim}
                  disabled={dkimGenerating}
                />
              </div>
            }
          >
            <p className="text-muted">{t('domains.overviewInfo')}</p>
            <DataTable
              columns={columns}
              data={domains}
              keyExtractor={(item) => item.domain}
              emptyMessage="domains.noDomains"
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        show={showGuideModal}
        onHide={() => setShowGuideModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {t('domains.dnsGuideCard')}
            {selectedDomain ? ` - ${selectedDomain.domain}` : ''}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedDomain && (
            <>
              <p className="mb-2">
                <strong>{t('domains.spf')}</strong> {t('domains.spfHelp')}
              </p>
              <p className="small mb-1">
                <strong>{t('domains.recordName')}:</strong>{' '}
                {selectedDomain.spf.recordName}
              </p>
              <p className="small mb-1">
                <strong>{t('domains.recordType')}:</strong>{' '}
                {selectedDomain.spf.recordType}
              </p>
              <code className="small text-break d-block mb-3">
                {selectedDomain.spf.recordValue}
              </code>

              <p className="mb-2">
                <strong>{t('domains.dmarc')}</strong> {t('domains.dmarcHelp')}
              </p>
              <p className="small mb-1">
                <strong>{t('domains.recordName')}:</strong>{' '}
                {selectedDomain.dmarc.recordName}
              </p>
              <p className="small mb-1">
                <strong>{t('domains.recordType')}:</strong>{' '}
                {selectedDomain.dmarc.recordType}
              </p>
              <code className="small text-break d-block mb-3">
                {selectedDomain.dmarc.recordValue}
              </code>

              <p className="mb-2">
                <strong>{t('domains.dkim')}</strong> {t('domains.dkimHelp')}
              </p>
              {selectedDomain.dkim.configured ? (
                <>
                  <p className="small mb-1">
                    <strong>{t('domains.recordName')}:</strong>{' '}
                    {selectedDomain.dkim.recordName}
                  </p>
                  <p className="small mb-1">
                    <strong>{t('domains.recordType')}:</strong>{' '}
                    {selectedDomain.dkim.recordType}
                  </p>
                  <code
                    className="small d-block overflow-auto"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {selectedDomain.dkim.recordValue}
                  </code>
                </>
              ) : (
                <AlertMessage type="warning" message="domains.noDkimHelp" />
              )}

              <p className="small text-muted mt-3 mb-0">
                {t('domains.testingInfo')}{' '}
                <a
                  href="https://mailtested.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  mailtested.com
                </a>
              </p>
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Domains;
