'use strict';

const path = require('path');
const { notarize, staple } = require('@electron/notarize');

module.exports = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  const apiKey = process.env.APPLE_API_KEY;
  const apiKeyId = process.env.APPLE_API_KEY_ID;
  const apiIssuer = process.env.APPLE_API_ISSUER;

  const hasAppleId = appleId && appleIdPassword && teamId;
  const hasApiKey = apiKey && apiKeyId && apiIssuer;

  if (!hasAppleId && !hasApiKey) {
    console.warn('Skipping notarization: missing Apple credentials.');
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const appBundleId = packager.appInfo.id;

  const notarizeOptions = {
    appBundleId,
    appPath
  };

  if (hasApiKey) {
    notarizeOptions.appleApiKey = apiKey;
    notarizeOptions.appleApiKeyId = apiKeyId;
    notarizeOptions.appleApiIssuer = apiIssuer;
  } else {
    notarizeOptions.appleId = appleId;
    notarizeOptions.appleIdPassword = appleIdPassword;
    notarizeOptions.teamId = teamId;
  }

  await notarize(notarizeOptions);
  await staple({ appPath });
};
