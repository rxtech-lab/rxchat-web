<a href="https://github.com/rxtech-lab/rxchat-web">
  <img alt="Next.js 15 and MCP router-enabled AI chatbot." src="app/(chat)/opengraph-image.png">
  <h1 align="center">RxChat</h1>
</a>

<p align="center">
    RxChat is a next-generation AI chatbot built with Next.js 15, featuring MCP (Model Context Protocol) router integration, advanced code execution, and artifact generation capabilities.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#technology-stack"><strong>Technology Stack</strong></a> ·
  <a href="#ai-capabilities"><strong>AI Capabilities</strong></a> ·
  <a href="#installation"><strong>Installation</strong></a> ·
  <a href="#development"><strong>Development</strong></a> ·
  <a href="#deployment"><strong>Deployment</strong></a>
</p>
<br/>

## Features

### 🚀 Core Platform
- **Next.js 15** with App Router and React Server Components
- **TypeScript** for type-safe development
- **Tailwind CSS** + **shadcn/ui** for modern UI components
- **SWR** for efficient data fetching and caching
- **Drizzle ORM** with PostgreSQL for robust data persistence

### 🤖 Advanced AI Capabilities
- **MCP Router Integration** - Model Context Protocol for enhanced tool connectivity
- **Multi-Provider Support** - OpenAI, Anthropic, Google Gemini, OpenRouter, xAI, and more
- **Streaming Conversations** - Real-time chat with AI models
- **Function Calling** - AI can use tools like weather, document creation, and search
- **Code Execution** - Run Python code with matplotlib support directly in chat

### 🛠️ Development Tools
- **Monaco Editor** - Full-featured code editor with TypeScript IntelliSense
- **Syntax Highlighting** - Support for multiple programming languages
- **Code Formatting** - Automatic code formatting with Cmd+S
- **Axios LSP Support** - Enhanced autocompletion for HTTP requests

### 📄 Artifact System
- **Code Artifacts** - Create, edit, and execute code snippets
- **Text Documents** - Rich text editing and collaboration
- **Image Generation** - AI-powered image creation and editing
- **Spreadsheets** - Data manipulation and visualization
- **Version Control** - Track changes and revert to previous versions

### 🔐 Authentication & Security
- **NextAuth.js** - Secure authentication system
- **Passkey Support** - Modern passwordless authentication
- **Role-based Access** - Admin, premium, regular, and free user tiers
- **User Scoped Data** - Isolated user data and permissions

### 📊 Management Features
- **Prompt Templates** - Create and manage reusable AI prompts
- **Chat History** - Persistent conversation storage
- **Document Search** - Full-text search across user documents
- **Usage Analytics** - Track model usage and costs
- **Export/Import** - Data portability features

## Technology Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe JavaScript development
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Modern React components
- **Framer Motion** - Smooth animations and transitions

### Backend & Database
- **Drizzle ORM** - Type-safe database toolkit
- **PostgreSQL** - Robust relational database
- **NextAuth.js** - Authentication solution
- **Redis** - Caching and session storage
- **Vercel Blob** - File storage solution

### AI & Tools
- **AI SDK** - Unified interface for LLM providers
- **MCP Router** - Model Context Protocol integration
- **Monaco Editor** - Advanced code editing
- **Python Execution** - vm2 for secure code execution
- **Multiple LLM Providers** - OpenAI, Anthropic, Google, etc.

### Development & Testing
- **pnpm** - Fast, disk space efficient package manager
- **ESLint** + **Biome** - Code linting and formatting
- **Jest** - Unit testing framework
- **Playwright** - End-to-end testing
- **TypeScript** - Static type checking

## AI Capabilities

### Supported AI Providers
- **OpenAI** - GPT-4, GPT-3.5, DALL-E
- **Anthropic** - Claude models
- **Google** - Gemini 2.5 Flash (default)
- **xAI** - Grok models
- **OpenRouter** - Access to 100+ models
- **Azure OpenAI** - Enterprise AI services

### MCP Router Integration
RxChat features advanced MCP (Model Context Protocol) integration that allows AI models to:
- Connect to external tools and services
- Execute code safely in sandboxed environments
- Access real-time data sources
- Interact with databases and APIs
- Perform complex multi-step tasks

### Built-in AI Tools
- **Weather Information** - Get current weather data
- **Document Creation** - Generate and edit documents
- **Search Documents** - Find information across user documents
- **Code Execution** - Run Python scripts with matplotlib support
- **Suggestion Engine** - AI-powered content improvements

## Installation

### Prerequisites
- **Node.js 18+** 
- **pnpm** (recommended) or npm/yarn
- **PostgreSQL** database
- **Redis** instance (optional, for caching)

### Environment Variables
Copy the environment variables from `.env.example` and configure them:

```bash
cp .env.example .env.local
```

Required environment variables:
```env
# Generate a random secret: https://generate-secret.vercel.app/32 or `openssl rand -base64 32`
AUTH_SECRET=

# The following keys below are automatically created and
# added to your environment when you deploy on vercel

OPENROUTER_API_KEY=
POSTGRES_URL=
REDIS_URL=
MCP_ROUTER_SERVER_URL=https://router.mcprouter.app/sse
MCP_ROUTER_SERVER_API_KEY=
AZURE_RESOURCE_NAME=
AZURE_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=rxchat
AWS_S3_ENDPOINT=
AWS_S3_CUSTOM_DOMAIN=
MARKITDOWN_ADMIN_API_KEY=
UPSTASH_VECTOR_REST_URL=
UPSTASH_VECTOR_REST_TOKEN=
```

### Database Setup

1. **Install dependencies:**
```bash
pnpm install
```

2. **Start PostgreSQL** (using Docker):
```bash
docker compose up -d
```

3. **Run database migrations:**
```bash
pnpm db:migrate
```

4. **Start the development server:**
```bash
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Development

### Available Scripts
```bash
# Development
pnpm dev              # Start development server with Turbo
pnpm build            # Build for production
pnpm start            # Start production server

# Database
pnpm db:generate      # Generate migration files
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Drizzle Studio
pnpm db:push          # Push schema changes

# Code Quality
pnpm lint             # Run ESLint and Biome
pnpm lint:fix         # Fix linting issues
pnpm format           # Format code with Biome

# Testing
pnpm test             # Run Playwright E2E tests
pnpm test:unit        # Run Jest unit tests
pnpm test:unit:watch  # Run unit tests in watch mode
```

### Project Structure
```
├── app/                    # Next.js app directory
│   ├── (auth)/            # Authentication pages
│   ├── (chat)/            # Chat interface
│   └── api/               # API routes
├── components/             # React components
│   ├── ui/                # Base UI components
│   └── input/             # Input-related components
├── lib/                   # Shared utilities
│   ├── ai/                # AI provider configurations
│   ├── db/                # Database schema and queries
│   └── utils.ts           # Utility functions
├── artifacts/             # Artifact type definitions
├── hooks/                 # Custom React hooks
└── tests/                 # Playwright tests
```

### Database Schema
The application uses Drizzle ORM with PostgreSQL. Key tables include:

- **Users** - User accounts with roles and provider access
- **Chats** - Conversation threads with visibility settings
- **Messages** - Chat messages with parts and attachments
- **Documents** - Generated artifacts (text, code, images, sheets)
- **Prompts** - User-created prompt templates
- **Suggestions** - AI-generated content improvements

## Deployment

### Vercel Deployment (Recommended)

1. **Fork this repository** to your GitHub account

2. **Deploy to Vercel:**
   - Connect your GitHub repository to Vercel
   - Configure environment variables in Vercel dashboard
   - Deploy automatically on every push

3. **Configure integrations:**
   - Set up PostgreSQL database (Neon, Supabase, or Vercel Postgres)
   - Configure blob storage (Vercel Blob)
   - Set up Redis for caching (Upstash)

### Manual Deployment

1. **Build the application:**
```bash
pnpm build
```

2. **Start the production server:**
```bash
pnpm start
```

## Usage

### Basic Chat
1. Sign up or log in to your account
2. Start a new conversation
3. Select your preferred AI model
4. Type your message and press Enter

### Authentication & User Roles
Users have multiple roles and can have different permissions to different models and providers:
- **Admin** - Full access to all models and system management
- **Premium** - Access to premium models and advanced features
- **Regular** - Standard model access with usage limits
- **Free** - Basic model access with restricted usage

We also support passkey login for secure, passwordless authentication that provides a modern and convenient login experience.

### Code Execution
1. Ask the AI to write Python code
2. The AI will create a code artifact
3. Click the "Run" button to execute the code
4. View output including matplotlib plots

### Document Creation
1. Request document creation from the AI
2. AI generates documents in various formats:
   - Text documents with rich formatting
   - Code files with syntax highlighting
   - Spreadsheets with data
   - Images generated by AI

### Prompt Templates
1. Click the prompt button in the input area
2. Create new templates or select existing ones
3. Templates can include TypeScript code for dynamic prompts
4. Share templates with other users (if permitted)

### MCP Tools
1. Available MCP tools are shown in the tools dropdown
2. AI can automatically use tools based on conversation context
3. Tools include weather data, search, document management, etc.

## API Endpoints

### Chat API
- `POST /api/chat` - Send messages and receive AI responses
- `GET /api/chat` - Retrieve chat history
- `DELETE /api/chat` - Delete chat conversations

### Document API
- `GET /api/document` - Retrieve documents by ID
- `POST /api/document` - Create or update documents
- `DELETE /api/document` - Delete documents

### User API
- `GET /api/user` - Get current user information
- `PATCH /api/user` - Update user preferences

### Prompt API
- `GET /api/prompts` - Get user prompt templates
- `POST /api/prompts` - Create new prompt templates
- `PATCH /api/prompts` - Update existing templates
- `DELETE /api/prompts` - Delete prompt templates

## Testing

### Unit Tests
```bash
pnpm test:unit          # Run all unit tests
pnpm test:unit:watch    # Run tests in watch mode
pnpm test:unit:coverage # Generate coverage report
```

### End-to-End Tests
```bash
pnpm test              # Run Playwright E2E tests
```

Test files are located in:
- `components/**/*.spec.tsx` - Component unit tests
- `tests/` - Playwright E2E tests

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and add tests
4. Run the test suite: `pnpm test:unit && pnpm test`
5. Commit your changes: `git commit -m 'Add new feature'`
6. Push to the branch: `git push origin feature/new-feature`
7. Submit a pull request

### Development Guidelines
- Use TypeScript for all new code
- Follow the existing code style (enforced by Biome)
- Write unit tests for new components
- Update documentation as needed
- Test changes with multiple AI providers

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/rxtech-lab/rxchat-web/issues)
- **Discussions**: [GitHub Discussions](https://github.com/rxtech-lab/rxchat-web/discussions)
- **Documentation**: See component READMEs in `components/` directories

## Acknowledgments

- Built with [Next.js](https://nextjs.org) and [Vercel AI SDK](https://sdk.vercel.ai)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Code editing powered by [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- Database toolkit by [Drizzle ORM](https://orm.drizzle.team)
