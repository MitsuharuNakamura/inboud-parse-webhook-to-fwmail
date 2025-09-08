# SendGrid Inbound Parse Webhook Server

This advanced server receives SendGrid Inbound Parse webhooks, processes incoming emails with detailed logging, automatic forwarding, and intelligent email routing based on keywords.

## Features

### 📧 Advanced Email Processing
- **Complete Email Parsing**: Extracts all email fields including headers, content, and attachments
- **Raw Data Display**: Shows formatted email content with proper sectioning
- **Bounce Email Handling**: Detects and processes delivery failure emails with detailed error information
- **Forwarded Message Detection**: Identifies and extracts forwarded email content and subjects

### 🔄 Intelligent Email Forwarding
- **Automatic SendGrid Integration**: Forwards processed emails via SendGrid API
- **Subject-Based Routing**: Routes emails to different recipients based on keyword matching
- **Multi-Priority Subject Detection**: Analyzes subjects from forwarded messages, bounce emails, and regular emails
- **Configurable Routing Rules**: Customizable keywords and destinations via environment variables

### 📊 Comprehensive Logging
- **Structured Console Output**: Color-coded sections with clear organization
- **Real-time Processing Status**: Shows email classification and routing decisions
- **Attachment Information**: Detailed attachment analysis including forwarded email detection
- **JSON Data Dump**: Complete raw data export for debugging

## Requirements
- Node.js 12 or higher
- SendGrid API Key for email forwarding

## Setup

### 1. Install Dependencies
```bash
git clone <repo-url>
cd InboundParseWebhookSever
npm install
```

### 2. Configure Environment Variables
Copy the example environment file and configure it:
```bash
cp .env.example .env
```

Edit `.env` file:
```env
# Server Configuration
PORT=3011
SENDGRID_API_KEY=your_sendgrid_api_key_here

# Subject Keywords for Email Routing (comma-separated)
SUBJECT_KEYWORDS_TYPE_A=invoice,receipt,payment
SUBJECT_KEYWORDS_TYPE_B=SendGrid,support,help,inquiry
SUBJECT_KEYWORDS_TYPE_C=bounce,undelivered,failure

# Email Forwarding Destinations
FORWARD_EMAIL_TYPE_A=accounting@halapolo.com
FORWARD_EMAIL_TYPE_B=halapolo1978@gmail.com
FORWARD_EMAIL_TYPE_C=halapolo.biz@gmail.com
FORWARD_EMAIL_DEFAULT=halapolo3286@gmail.com
```

## Email Routing System

The server automatically categorizes and routes emails based on subject keywords:

### 📋 Type A - Financial/Business
- **Keywords**: invoice, receipt, payment
- **Use Case**: Accounting and financial documents
- **Default Route**: accounting@halapolo.com

### 💬 Type B - Support/Communication  
- **Keywords**: SendGrid, support, help, inquiry
- **Use Case**: Customer support and technical communications
- **Default Route**: halapolo1978@gmail.com

### ⚠️ Type C - System Alerts
- **Keywords**: bounce, undelivered, failure
- **Use Case**: Delivery failures and system notifications
- **Default Route**: halapolo.biz@gmail.com

### 📧 Default Route
- **Fallback**: Any emails not matching above categories
- **Default Route**: halapolo3286@gmail.com

## Running the Server

### Production Mode
```bash
npm start
```

### Development Mode (auto-reload)
```bash
npm run dev
```

Server will start on the configured port (default: 3011) and display:
```
✅ SendGrid API initialized
Server is running on port 3011
```

## SendGrid Configuration

### 1. Inbound Parse Setup
1. In SendGrid dashboard: **Settings** > **Inbound Parse**
2. Add hostname and set destination URL:
   ```
   http://<your-domain>:3011/inbound
   ```
3. Enable desired options (attachments, spam check, etc.)

### 2. API Key Setup
1. Generate SendGrid API key with Mail Send permissions
2. Add to `.env` file as `SENDGRID_API_KEY`

## API Endpoints

### POST /inbound
**Primary webhook endpoint for SendGrid Inbound Parse**

Processes incoming emails and:
- Parses all email fields and attachments
- Detects forwarded messages and extracts original subjects
- Analyzes bounce emails for delivery failure details
- Routes emails based on subject keywords
- Forwards emails via SendGrid to configured recipients
- Logs comprehensive processing information

### GET /
**Health check endpoint**
Returns: `SendGrid Inbound Parse Webhook Server is running`

## Email Processing Flow

### 1. Email Reception
```
📧 INBOUND EMAIL RECEIVED
📅 Timestamp: 2025-09-08T03:03:18.137Z
```

### 2. Content Analysis
- **Basic Info**: From, To, CC, BCC, Subject
- **Security**: DKIM, SPF validation
- **Content**: Text, HTML, and raw email data
- **Attachments**: File analysis with special handling for forwarded emails

### 3. Subject Detection Priority
1. **Forwarded Message Subject** (highest priority)
   - From `---------- Forwarded message ----------` sections
   - Extracted from bounce email embedded messages
2. **Original Email Subject** (medium priority)
   - From bounce email metadata
3. **Current Email Subject** (lowest priority)
   - From incoming email headers

### 4. Email Classification
```
📨 EMAIL CLASSIFICATION:
   Subject analyzed: "Hello from SendGrid + curl"
   Email Type: TYPE_B
   Forward To: halapolo1978@gmail.com
```

### 5. Automatic Forwarding
- Sends formatted email with original content
- Includes delivery failure details for bounce emails
- Attaches original email data as `.eml` file
- Provides comprehensive forwarding logs

## Advanced Features

### Bounce Email Processing
Automatically detects delivery failures and extracts:
- **Failed Recipient**: Original destination email
- **Failure Reason**: Detailed error message
- **Original Message**: Complete original email content
- **Delivery Status**: SMTP response codes and diagnostic information

### Forwarded Message Handling
Identifies forwarded emails from various formats:
- Gmail forwarded messages
- Outlook forwarded messages
- Japanese email client formats
- Custom forwarding patterns

### Attachment Processing
- **Complete File Information**: Name, type, size
- **Email Attachment Detection**: Identifies `.eml` and `message/rfc822` files
- **Preview Generation**: Shows content preview for email attachments
- **Security Information**: File type validation and size limits

## Troubleshooting

### Common Issues

1. **SendGrid API Key Issues**
   ```
   ⚠️ Warning: SENDGRID_API_KEY not found in environment variables
   ```
   Solution: Ensure API key is properly set in `.env` file

2. **Email Forwarding Failures**
   Check console output for detailed error messages and verify:
   - API key permissions
   - Sender domain authentication
   - Recipient email validity

3. **Subject Detection Problems**
   Enable detailed logging to see subject detection process:
   ```
   🔍 Searching for Subject in email field...
   ✅ Found forwarded subject: "Your Subject Here"
   ```

### Debug Mode
The server provides extensive logging by default. Monitor the console output to track:
- Email processing stages
- Subject detection results
- Routing decisions
- Forwarding status

## Development

### File Structure
```
├── index.js          # Main server application
├── package.json      # Dependencies and scripts
├── .env.example      # Environment configuration template
├── README.md         # This documentation
└── .gitignore       # Git ignore patterns
```

### Extending Functionality
The routing system supports custom processing for each email type in the `switch` statement (lines 305-322 in `index.js`):

```javascript
switch (emailType) {
  case 'TYPE_A':
    // Add custom invoice processing logic
    break;
  case 'TYPE_B':
    // Add custom support ticket logic  
    break;
  case 'TYPE_C':
    // Add custom bounce handling logic
    break;
  default:
    // Add default processing logic
    break;
}
```

## License

MIT License - See LICENSE file for details.

---

For support or feature requests, please create an issue in the repository.