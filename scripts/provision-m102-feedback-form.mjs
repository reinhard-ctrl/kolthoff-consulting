#!/usr/bin/env node
/**
 * Provision the Kolthoff Mod 1 anonymous feedback Google Form master template (m1-02).
 *
 * Prerequisites:
 *   - Enable Google Forms API: https://console.cloud.google.com/apis/library/forms.googleapis.com?project=kolthoff-portal
 *   - Service account or user credentials with scopes:
 *       https://www.googleapis.com/auth/forms.body
 *       https://www.googleapis.com/auth/drive
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/provision-m102-feedback-form.mjs
 *
 * Output:
 *   - Creates/updates the master form in the authenticated Google account
 *   - Writes formId into shared/diagnosis-report-helpers.js (templateFormId)
 *   - Prints copy + view URLs for the diagnosis report launcher
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import { google } from 'googleapis';

const require = createRequire(import.meta.url);
const DRH = require('../shared/diagnosis-report-helpers.js');
const template = DRH.getM102FeedbackFormTemplate();

const HELPERS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '../shared/diagnosis-report-helpers.js');
const SCOPES = [
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/drive',
];

function buildCreateItemRequest(question, index) {
  if (question.type === 'section') {
    return {
      createItem: {
        item: {
          title: question.title,
          description: question.description || undefined,
          pageBreakItem: {},
        },
        location: { index },
      },
    };
  }

  const item = {
    title: question.title,
    description: question.description || undefined,
  };

  if (question.type === 'paragraph') {
    item.questionItem = {
      question: {
        required: question.required !== false,
        textQuestion: { paragraph: true },
      },
    };
  } else if (question.type === 'short') {
    item.questionItem = {
      question: {
        required: question.required !== false,
        textQuestion: {},
      },
    };
  } else if (question.type === 'choice') {
    item.questionItem = {
      question: {
        required: question.required !== false,
        choiceQuestion: {
          type: 'RADIO',
          options: (question.options || []).map((value) => ({ value })),
        },
      },
    };
  } else if (question.type === 'scale') {
    item.questionItem = {
      question: {
        required: question.required !== false,
        scaleQuestion: {
          low: question.low ?? 1,
          high: question.high ?? 5,
          lowLabel: question.lowLabel || '',
          highLabel: question.highLabel || '',
        },
      },
    };
  } else {
    throw new Error(`Unsupported question type: ${question.type}`);
  }

  return { createItem: { item, location: { index } } };
}

function patchHelpersFormId(formId) {
  const source = readFileSync(HELPERS_PATH, 'utf8');
  const next = source.replace(
    /templateFormId:\s*'[^']*'/,
    `templateFormId: '${formId}'`,
  );
  if (next === source) {
    throw new Error('Could not update templateFormId in diagnosis-report-helpers.js');
  }
  writeFileSync(HELPERS_PATH, next, 'utf8');
}

async function main() {
  const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
  const authClient = await auth.getClient();
  const forms = google.forms({ version: 'v1', auth: authClient });

  const createResp = await forms.forms.create({
    requestBody: {
      info: {
        title: template.title,
        documentTitle: template.documentTitle,
        description: template.description,
      },
    },
  });

  const formId = createResp.data.formId;
  if (!formId) throw new Error('forms.create did not return formId');

  const requests = (template.questions || []).map((q, idx) => buildCreateItemRequest(q, idx));
  if (requests.length) {
    await forms.forms.batchUpdate({
      formId,
      requestBody: { requests },
    });
  }

  if (template.settings?.collectEmail === false) {
    await forms.forms.batchUpdate({
      formId,
      requestBody: {
        requests: [{
          updateSettings: {
            settings: { emailCollectionType: 'DO_NOT_COLLECT' },
            updateMask: 'emailCollectionType',
          },
        }],
      },
    });
  }

  const copyUrl = DRH.buildFeedbackFormTemplateCopyUrl(formId);
  const viewUrl = DRH.buildFeedbackFormViewUrl(formId);

  patchHelpersFormId(formId);

  console.log('m1-02 feedback form template provisioned.');
  console.log(`formId: ${formId}`);
  console.log(`copyUrl: ${copyUrl}`);
  console.log(`viewUrl: ${viewUrl}`);
  console.log('');
  console.log('Next steps:');
  console.log('1. In Google Drive, share the master form: anyone with the link → Editor (for /copy to work).');
  console.log('2. Commit shared/diagnosis-report-helpers.js and deploy.');
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
