// utils/leakPatterns.ts

export const leakPatterns = [
  {
    name: 'AWS Access Key',
    regex: /AKIA[0-9A-Z]{16}/g,
    severity: 'high',
  },
  {
    name: 'AWS Secret Key',
    regex: /aws.{0,20}(secret|access)?.{0,20}?["']([0-9a-zA-Z/+]{40})["']/gi,
    severity: 'critical',
  },
  {
    name: 'Google API Key',
    regex: /AIza[0-9A-Za-z-_]{35}/g,
    severity: 'high',
  },
  {
    name: 'JWT Token',
    regex: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/g,
    severity: 'medium',
  },
  {
    name: '.env file var',
    regex: /^[A-Z0-9_]{3,40}=["']?[a-zA-Z0-9\-_$\/+=:.]{5,100}["']?$/gm,
    severity: 'medium',
  },
  {
    name: 'Private RSA Key',
    regex: /-----BEGIN RSA PRIVATE KEY-----/,
    severity: 'critical',
  },
];
