#!/usr/bin/env node
/** Update admin login handlers to use Cloud Function verifyAdminPasscode */
const fs = require('fs');
const path = require('path');

const files = [
  'admin/legacy/admin_console.html',
  'admin/legacy/intake_center.html',
  'admin/legacy/contract_ledger.html',
  'admin/legacy/core_master_admin.html',
];

const oldHandler = `                try {
                    const docRef = window.doc(window.firebaseDb, 'artifacts', window.appId, 'public', 'data', 'admin_credentials', cleanCode);
                    const docSnap = await window.getDoc(docRef);
                    if (docSnap.exists()) {
                        setIsAdminAuthed(true);
                        setAuthError('');
                    } else {
                        setAuthError('Invalid admin passcode.');
                    }
                } catch (e) {
                    console.error(e);
                    setAuthError('Authentication failed.');
                }`;

const newHandler = `                try {
                    const result = await window.verifyAdminPasscode(cleanCode);
                    if (result.valid) {
                        setIsAdminAuthed(true);
                        setAuthError('');
                    } else {
                        setAuthError('Invalid admin passcode.');
                    }
                } catch (e) {
                    console.error(e);
                    setAuthError('Authentication failed. Deploy Cloud Functions if unavailable.');
                }`;

const oldHandlerMaster = oldHandler.replace(/window\.appId/g, 'window.masterAppId');

for (const rel of files) {
  const fp = path.join(__dirname, '..', rel);
  let content = fs.readFileSync(fp, 'utf8');
  if (rel.includes('core_master_admin')) {
    content = content.replace(oldHandlerMaster, newHandler.replace(/window\.appId/g, 'window.masterAppId'));
  } else {
    content = content.replace(oldHandler, newHandler);
  }
  fs.writeFileSync(fp, content);
  console.log('Updated auth:', rel);
}
