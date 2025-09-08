#!/usr/bin/env node
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sgMail = require('@sendgrid/mail');

// MIMEエンコードされた件名をデコードする関数
function decodeMimeSubject(encodedSubject) {
  if (!encodedSubject) return encodedSubject;
  
  try {
    // =?charset?encoding?encoded-text?= の形式をデコード
    const mimeRegex = /=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi;
    
    return encodedSubject.replace(mimeRegex, (match, charset, encoding, encodedText) => {
      try {
        if (encoding.toUpperCase() === 'B') {
          // Base64デコード
          const decoded = Buffer.from(encodedText, 'base64').toString('utf8');
          console.log(`  Decoded Base64: "${encodedText}" -> "${decoded}"`);
          return decoded;
        } else if (encoding.toUpperCase() === 'Q') {
          // Quoted-Printableデコード
          const decoded = encodedText
            .replace(/_/g, ' ')
            .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
          console.log(`  Decoded Quoted-Printable: "${encodedText}" -> "${decoded}"`);
          return decoded;
        }
      } catch (decodeError) {
        console.log(`  Decode error for "${encodedText}":`, decodeError.message);
        return match; // デコードに失敗した場合は元の文字列を返す
      }
      return match;
    });
  } catch (error) {
    console.log(`  MIME decode error:`, error.message);
    return encodedSubject;
  }
}

// サーバーとミドルウェアの初期化
const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3011;

// SendGrid APIキーの設定
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('SendGrid API initialized');
} else {
  console.log('Warning: SENDGRID_API_KEY not found in environment variables');
}

// メイン処理：SendGridからのInbound Parse Webhookを受信
app.post('/inbound', upload.any(), async (req, res) => {
  // リクエストボディからメールデータを取得
  const {
    from, to, subject, text, html, headers,
    cc, bcc, dkim, spf, envelope, charsets, raw
  } = req.body;

  // ログ出力開始
  console.log('\n' + '='.repeat(80));
  console.log('INBOUND EMAIL RECEIVED');
  console.log('='.repeat(80));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('-'.repeat(80));
  
  // 基本情報の表示
  console.log('\nBASIC INFO:');
  console.log(`  From: ${from || 'N/A'}`);
  console.log(`  To: ${to || 'N/A'}`);
  console.log(`  CC: ${cc || 'N/A'}`);
  console.log(`  BCC: ${bcc || 'N/A'}`);
  console.log(`  Subject: ${subject || 'N/A'}`);
  
  // セキュリティ情報の表示
  console.log('\nSECURITY:');
  console.log(`  DKIM: ${dkim || 'N/A'}`);
  console.log(`  SPF: ${spf || 'N/A'}`);
  
  // エンベロープ情報の表示
  console.log('\nENVELOPE:');
  if (envelope) {
    try {
      const envData = typeof envelope === 'string' ? JSON.parse(envelope) : envelope;
      console.log(`  From: ${envData.from || 'N/A'}`);
      console.log(`  To: ${Array.isArray(envData.to) ? envData.to.join(', ') : envData.to || 'N/A'}`);
    } catch (e) {
      console.log(`  Raw: ${envelope}`);
    }
  } else {
    console.log('  N/A');
  }
  
  // ヘッダー情報の表示
  console.log('\nHEADERS:');
  if (headers) {
    const headerLines = headers.split('\n');
    headerLines.forEach(line => {
      if (line.trim()) {
        console.log(`  ${line}`);
      }
    });
  } else {
    console.log('  N/A');
  }
  
  // テキストコンテンツの表示
  console.log('\nTEXT CONTENT:');
  if (text) {
    console.log('-'.repeat(40));
    console.log(text);
    console.log('-'.repeat(40));
  } else {
    console.log('  No text content');
  }
  
  // HTMLコンテンツの表示
  console.log('\nHTML CONTENT:');
  if (html) {
    console.log(`  Length: ${html.length} characters`);
    if (html.length < 500) {
      console.log('-'.repeat(40));
      console.log(html);
      console.log('-'.repeat(40));
    } else {
      console.log(`  [HTML content too long, showing first 500 chars]`);
      console.log('-'.repeat(40));
      console.log(html.substring(0, 500) + '...');
      console.log('-'.repeat(40));
    }
  } else {
    console.log('  No HTML content');
  }
  
  // バウンスメール解析と件名抽出の初期化
  let bounceDetails = null;       // バウンス詳細情報
  let originalMessage = null;     // 元のメッセージ内容
  let originalSubject = null;     // 元のメール件名
  let forwardedSubject = null;    // 転送メールの件名
  
  // emailフィールドからバウンス情報と件名を解析
  if (req.body.email) {
    const emailContent = req.body.email;
    
    // バウンス失敗情報の抽出
    const failureMatch = emailContent.match(/Action: failed[\s\S]*?Status: ([\d.]+)[\s\S]*?Diagnostic-Code: (.+?)(?:\r\n|\n)/);
    const recipientMatch = emailContent.match(/Final-Recipient: rfc822; (.+?)(?:\r\n|\n)/);
    const origFromMatch = emailContent.match(/\nFrom: (.+?)(?:\r\n|\n)/);
    const origToMatch = emailContent.match(/\nTo: (.+?)(?:\r\n|\n)/);
    const origSubjectMatch = emailContent.match(/\nSubject: (.+?)(?:\r\n|\n)/);
    const origDateMatch = emailContent.match(/\nDate: (.+?)(?:\r\n|\n)/);
    
    // 元の件名を保存
    if (origSubjectMatch) {
      originalSubject = origSubjectMatch[1];
    }
    
    // バウンス情報の構築
    if (failureMatch || recipientMatch) {
      bounceDetails = {
        failedRecipient: recipientMatch ? recipientMatch[1] : null,
        reason: failureMatch ? failureMatch[2].replace(/^\d+\s+/, '') : null,
        originalFrom: origFromMatch ? origFromMatch[1] : null,
        originalTo: origToMatch ? origToMatch[1] : null,
        originalSubject: originalSubject,
        originalDate: origDateMatch ? origDateMatch[1] : null
      };
    }
    
    // 元のメッセージテキストを抽出
    const textMatch = emailContent.match(/Content-Type: text\/plain[\s\S]*?\n\n([\s\S]*?)(?:--\w+|$)/);
    if (textMatch) {
      originalMessage = textMatch[1].trim();
    }
    
    // emailフィールドから転送された件名を検索
    console.log('\nSearching for Subject in email field...');
    const subjectMatches = emailContent.match(/Subject:\s*(.+?)(?:\r\n|\n)/g);
    if (subjectMatches && subjectMatches.length > 0) {
      console.log(`  Found ${subjectMatches.length} Subject line(s):`);
      
      // 各件名をチェックして適切なものを選択
      for (let i = 0; i < subjectMatches.length; i++) {
        const match = subjectMatches[i].match(/Subject:\s*(.+?)(?:\r\n|\n)/);
        if (match) {
          let subjectValue = match[1].trim();
          console.log(`  Subject ${i + 1} (raw): "${subjectValue}"`);
          
          // MIMEエンコードされた件名をデコード
          const decodedSubject = decodeMimeSubject(subjectValue);
          subjectValue = decodedSubject;
          console.log(`  Subject ${i + 1} (decoded): "${subjectValue}"`);
          
          // バウンス関連の件名をスキップ
          if (!subjectValue.toLowerCase().includes('undelivered') && 
              !subjectValue.toLowerCase().includes('returned to sender') &&
              !subjectValue.toLowerCase().includes('delivery failure') &&
              !subjectValue.toLowerCase().includes('mail delivery failed')) {
            forwardedSubject = subjectValue;
            console.log(`  Using Subject ${i + 1} as forwarded subject: "${forwardedSubject}"`);
            break;
          }
        }
      }
      
      // 適切な件名が見つからない場合は最後の件名を使用
      if (!forwardedSubject && subjectMatches.length > 1) {
        const lastMatch = subjectMatches[subjectMatches.length - 1].match(/Subject:\s*(.+?)(?:\r\n|\n)/);
        if (lastMatch) {
          let lastSubject = lastMatch[1].trim();
          // 最後の件名もデコード
          forwardedSubject = decodeMimeSubject(lastSubject);
          console.log(`  Using last Subject as forwarded subject (decoded): "${forwardedSubject}"`);
        }
      }
    }
    
    if (!forwardedSubject) {
      console.log('  No suitable subject found in email field');
    }
  }
  
  // rawフィールドをフォールバックとして使用
  if (!forwardedSubject && raw) {
    console.log('\nChecking raw field as fallback...');
    const forwardedMatch = raw.match(/---------- Forwarded message ----------[\s\S]*?Subject:\s*(.+?)(?:\r\n|\n)/);
    if (forwardedMatch) {
      let rawSubject = forwardedMatch[1].trim();
      // rawフィールドの件名もデコード
      forwardedSubject = decodeMimeSubject(rawSubject);
      console.log(`  Found forwarded subject in raw (decoded): "${forwardedSubject}"`);
    }
  }
  
  // 分類用件名の決定（優先順位: 転送件名 > 元件名 > 現在件名）
  const subjectToCheck = forwardedSubject || originalSubject || subject || '';
  console.log(`\nSUBJECT DETECTION:`);
  if (forwardedSubject) {
    console.log(`  Using forwarded message subject: "${forwardedSubject}"`);
  } else if (originalSubject) {
    console.log(`  Using original email subject: "${originalSubject}"`);
  } else if (subject) {
    console.log(`  Using current email subject: "${subject}"`);
  } else {
    console.log(`  No subject found`);
  }
  
  // メール分類とルーティング処理
  const subjectLower = subjectToCheck.toLowerCase();
  let emailType = 'DEFAULT';
  let forwardTo = process.env.FORWARD_EMAIL_DEFAULT || 'halapolo3286@gmail.com';
  
  // Type Aキーワードチェック
  if (process.env.SUBJECT_KEYWORDS_TYPE_A) {
    const keywordsA = process.env.SUBJECT_KEYWORDS_TYPE_A.split(',').map(k => k.trim().toLowerCase());
    if (keywordsA.some(keyword => subjectLower.includes(keyword))) {
      emailType = 'TYPE_A';
      forwardTo = process.env.FORWARD_EMAIL_TYPE_A || forwardTo;
    }
  }
  
  // Type Bキーワードチェック
  if (process.env.SUBJECT_KEYWORDS_TYPE_B) {
    const keywordsB = process.env.SUBJECT_KEYWORDS_TYPE_B.split(',').map(k => k.trim().toLowerCase());
    if (keywordsB.some(keyword => subjectLower.includes(keyword))) {
      emailType = 'TYPE_B';
      forwardTo = process.env.FORWARD_EMAIL_TYPE_B || forwardTo;
    }
  }
  
  // Type Cキーワードチェック
  if (process.env.SUBJECT_KEYWORDS_TYPE_C) {
    const keywordsC = process.env.SUBJECT_KEYWORDS_TYPE_C.split(',').map(k => k.trim().toLowerCase());
    if (keywordsC.some(keyword => subjectLower.includes(keyword))) {
      emailType = 'TYPE_C';
      forwardTo = process.env.FORWARD_EMAIL_TYPE_C || forwardTo;
    }
  }
  
  // 分類結果の表示
  console.log(`\nEMAIL CLASSIFICATION:`);
  console.log(`  Subject analyzed: "${subjectToCheck}"`);
  console.log(`  Email Type: ${emailType}`);
  console.log(`  Forward To: ${forwardTo}`);
  
  // メールタイプに応じたカスタム処理
  switch (emailType) {
    case 'TYPE_A':
      console.log(`  Processing as TYPE_A`);
      // 請求書・決済関連の特別処理をここに追加
      break;
    case 'TYPE_B':
      console.log(`  Processing as TYPE_B`);
      // サポート・問い合わせ関連の特別処理をここに追加
      break;
    case 'TYPE_C':
      console.log(`  Processing as TYPE_C`);
      // バウンス・失敗関連の特別処理をここに追加
      break;
    default:
      console.log(`  Processing as DEFAULT type`);
      // デフォルト処理をここに追加
      break;
  }
  
  // 添付ファイルの処理
  const attachments = (req.files || []).map((file) => ({
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    content: file.buffer.toString('base64').substring(0, 100) + '...'
  }));
  
  // 添付ファイル情報の表示
  console.log('\nATTACHMENTS:');
  if (attachments.length > 0) {
    attachments.forEach((att, index) => {
      console.log(`  [${index + 1}] ${att.originalName}`);
      console.log(`      Type: ${att.mimetype}`);
      console.log(`      Size: ${att.size} bytes`);
      
      // RFC822形式（転送メール添付）の特別処理
      if (att.mimetype === 'message/rfc822') {
        console.log('      This is a forwarded email attachment');
        const fullFile = req.files[index];
        const emailContent = fullFile.buffer.toString('utf-8');
        console.log('      Forwarded Email Content Preview:');
        const lines = emailContent.split('\n').slice(0, 20);
        lines.forEach(line => console.log('        ' + line));
        if (emailContent.split('\n').length > 20) {
          console.log('        ... [truncated]');
        }
      }
    });
  } else {
    console.log('  No attachments');
  }
  
  // 完全なJSONデータダンプ
  console.log('\n' + '='.repeat(80));
  console.log('FULL JSON DUMP:');
  console.log('='.repeat(80));
  
  const fullData = {
    timestamp: new Date().toISOString(),
    body: req.body,
    files: req.files ? req.files.map(f => ({
      fieldname: f.fieldname,
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      encoding: f.encoding
    })) : []
  };
  
  console.log(JSON.stringify(fullData, null, 2));
  
  console.log('\n' + '='.repeat(80));
  console.log('EMAIL PROCESSING COMPLETE');
  console.log('='.repeat(80) + '\n');

  // SendGridを使用したメール転送処理
  if (process.env.SENDGRID_API_KEY) {
    console.log('\nFORWARDING EMAIL VIA SENDGRID...');
    
    try {
      // SendGrid用添付ファイルの準備
      const sgAttachments = req.files ? req.files.map(file => ({
        content: file.buffer.toString('base64'),
        filename: file.originalname,
        type: file.mimetype,
        disposition: 'attachment'
      })) : [];
      
      // 転送メールのHTMLコンテンツ構築
      let forwardedContent = `<div style="font-family: Arial, sans-serif;">`;
      forwardedContent += `<div style="background: #f0f0f0; padding: 10px; margin-bottom: 20px;">`;
      forwardedContent += `<strong>Forwarded Email from Inbound Parse</strong><br/>`;
      forwardedContent += `<strong>Original From:</strong> ${from || 'N/A'}<br/>`;
      forwardedContent += `<strong>Original To:</strong> ${to || 'N/A'}<br/>`;
      forwardedContent += `<strong>Original Subject:</strong> ${subject || 'N/A'}<br/>`;
      forwardedContent += `<strong>Received:</strong> ${new Date().toISOString()}<br/>`;
      if (cc) forwardedContent += `<strong>CC:</strong> ${cc}<br/>`;
      if (bcc) forwardedContent += `<strong>BCC:</strong> ${bcc}<br/>`;
      forwardedContent += `</div>`;
      
      // バウンス詳細情報がある場合は追加
      if (bounceDetails) {
        forwardedContent += `<div style="background: #ffebee; padding: 15px; margin: 20px 0; border-left: 4px solid #f44336;">`;
        forwardedContent += `<h3 style="color: #d32f2f; margin-top: 0;">Delivery Failure Details</h3>`;
        forwardedContent += `<strong>Failed Recipient:</strong> ${bounceDetails.failedRecipient || 'N/A'}<br/>`;
        forwardedContent += `<strong>Failure Reason:</strong> ${bounceDetails.reason || 'N/A'}<br/>`;
        if (bounceDetails.originalFrom) {
          forwardedContent += `<br/><strong>Original Message Details:</strong><br/>`;
          forwardedContent += `<strong>From:</strong> ${bounceDetails.originalFrom}<br/>`;
          forwardedContent += `<strong>To:</strong> ${bounceDetails.originalTo || 'N/A'}<br/>`;
          forwardedContent += `<strong>Subject:</strong> ${bounceDetails.originalSubject || 'N/A'}<br/>`;
          forwardedContent += `<strong>Date:</strong> ${bounceDetails.originalDate || 'N/A'}<br/>`;
        }
        forwardedContent += `</div>`;
        
        // 元のメッセージ内容がある場合は表示
        if (originalMessage) {
          forwardedContent += `<div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #2196F3;">`;
          forwardedContent += `<h4 style="margin-top: 0;">Original Message Content:</h4>`;
          forwardedContent += `<pre style="white-space: pre-wrap; word-wrap: break-word; font-family: monospace;">${originalMessage}</pre>`;
          forwardedContent += `</div>`;
        }
      }
      
      // HTMLまたはテキストコンテンツを追加
      if (html) {
        forwardedContent += `<div style="border-left: 3px solid #ccc; padding-left: 10px; margin-top: 20px;">`;
        forwardedContent += html;
        forwardedContent += `</div>`;
      } else if (text) {
        forwardedContent += `<div style="border-left: 3px solid #ccc; padding-left: 10px; margin-top: 20px;">`;
        forwardedContent += `<pre style="white-space: pre-wrap; word-wrap: break-word;">${text}</pre>`;
        forwardedContent += `</div>`;
      }
      
      // 元のメールデータを添付ファイルとして追加
      if (req.body.email) {
        forwardedContent += `<div style="margin-top: 20px; padding: 10px; background: #f9f9f9; border: 1px solid #ddd;">`;
        forwardedContent += `<strong>Note:</strong> The complete raw email data has been attached as 'original_email.eml'</div>`;
        
        sgAttachments.push({
          content: Buffer.from(req.body.email).toString('base64'),
          filename: 'original_email.eml',
          type: 'message/rfc822',
          disposition: 'attachment'
        });
      }
      
      forwardedContent += `</div>`;
      
      // SendGrid送信用メッセージオブジェクト
      const msg = {
        to: forwardTo,
        from: 'support@halapolo.com',
        subject: `[Forwarded] ${subject || 'No Subject'}`,
        html: forwardedContent,
        attachments: sgAttachments
      };
      
      // メール送信実行
      await sgMail.send(msg);
      console.log(`Email forwarded successfully to ${forwardTo}`);
      console.log(`  From: support@halapolo.com`);
      console.log(`  Subject: [Forwarded] ${subject || 'No Subject'}`);
      console.log(`  Email Type: ${emailType}`);
      if (sgAttachments.length > 0) {
        console.log(`  Attachments: ${sgAttachments.length} file(s) included`);
      }
    } catch (error) {
      console.error('Error forwarding email via SendGrid:');
      console.error('  Error:', error.message);
      if (error.response && error.response.body) {
        console.error('  Response:', JSON.stringify(error.response.body, null, 2));
      }
    }
  } else {
    console.log('\nSkipping email forwarding - SENDGRID_API_KEY not configured');
  }

  // HTTPレスポンス送信
  res.status(200).send('OK');
});

// ヘルスチェック用エンドポイント
app.get('/', (req, res) => {
  res.send('SendGrid Inbound Parse Webhook Server is running');
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});