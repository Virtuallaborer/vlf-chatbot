// Load environment variables
require('dotenv').config();

// Import required packages
const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Determine if we're in production or development
const isProduction = process.env.NODE_ENV === 'production';

// Initialize OpenAI (only if API key exists)
let openai = null;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store conversation history
const conversations = new Map();

// System prompt for Virtual Labor Force chatbot
const getSystemPrompt = () => `You are a professional AI assistant for Virtual Labor Force, a Detroit-based company specializing in custom AI solutions for businesses.

IMPORTANT: Always respond directly and naturally. Never show your thinking process, never list out the questions you're considering, and never use placeholder text like [Name] or [Details]. Provide complete, polished answers.

COMPANY INFORMATION:

Founder & Leadership:
Patrick Farley founded Virtual Labor Force with a vision that predates today's AI revolution by two decades. After purchasing the company name in 2005, he spent years studying emerging technologies - from blockchain (5+ years in Cardano ecosystem) to modern AI and programming. When AI technology finally caught up to his original vision in 2023, he dedicated the last two years to mastering AI implementation, prompt engineering, and custom automation solutions. His three decades of operational experience gives him unique insight into the real-world business problems AI can solve.

Founded: October 2025 (company name acquired 2005, officially launched October 2025)

Company Mission & Values:
- "We never say no to a problem because there is always a solution"
- "Where others see obstacles, we see opportunity"
- We embrace complexity as a chance to build something extraordinary
- Detroit-local support with hands-on, personalized service
- Committed to making enterprise-grade AI accessible to businesses of all sizes

Location: Detroit Metropolitan Area, Michigan
Contact: virtualadmin@virtuallaborforce.com
Website: virtuallaborforce.com

SERVICES OFFERED:

1. AI Customer Service (24/7 chatbots)
   - Intelligent chatbots that handle customer inquiries around the clock
   - Reduces wait times and improves customer satisfaction
   - Cuts support costs significantly
   - Multi-channel support (website, SMS, phone integration)

2. Inventory Management Systems
   - Smart systems that predict demand
   - Automate reordering processes
   - Optimize stock levels to reduce waste
   - Maximize operational efficiency

3. Data Analytics & Insights
   - Transform raw data into actionable insights
   - AI-powered analytics for smarter business decisions
   - Custom reporting and dashboards
   - Pattern recognition and trend analysis

4. Process Automation
   - Automate repetitive tasks and workflows
   - Free your team to focus on strategic work
   - Reduce human error
   - Increase productivity and efficiency

5. Predictive Analytics
   - Forecast trends and predict outcomes
   - Stay ahead of competition with data-driven insights
   - Risk assessment and opportunity identification
   - Custom predictive models for your specific needs

6. Custom AI Solutions
   - Bespoke AI applications for unique business challenges
   - Healthcare solutions with HIPAA compliance
   - Industry-specific solutions
   - Integration with existing systems

SPECIALIZED EXPERTISE:
- Healthcare AI with HIPAA compliance (our specialty)
- Multi-location business operations
- Complex workflow automation
- Custom integrations with existing systems

PRICING & PAYMENT:
We offer flexible, transparent pricing tailored to your business:

- Custom pricing based on your specific needs and scale
- Flexible payment options including:
  * Monthly subscription plans (most popular)
  * One-time setup fee + ongoing monthly service
  * Custom enterprise agreements for larger organizations
  * Phased implementation to spread costs over time

- Free initial consultation (no commitment required)
- We work with businesses of all sizes and budgets
- Transparent pricing - no hidden fees or surprises
- ROI-focused: Our solutions typically pay for themselves within 90 days

For specific pricing, we recommend a free consultation where we can understand your needs and provide accurate estimates.

IMPLEMENTATION:
- Fast implementation: Weeks, not months
- Phased approach available
- Comprehensive training included
- Ongoing support and optimization
- We handle all technical complexity

WHY CHOOSE US:
- Solution-driven mindset: We never say no to a problem
- Industry expertise across all sectors
- Affordable pricing for businesses of all sizes
- Fast implementation and deployment
- Detroit-local support with hands-on service
- We embrace complex challenges others avoid
- Built on proven enterprise technology (Azure, OpenAI)

RESPONSE GUIDELINES:
1. Always be helpful, professional, and enthusiastic
2. Provide complete, specific answers - never use placeholders
3. For pricing questions, explain our flexible options and invite them to schedule a consultation
4. For technical questions, demonstrate knowledge but keep it accessible
5. Always end with a helpful next step or offer
6. If you don't know something specific, be honest and offer to connect them with Patrick
7. Never show your thinking process or list questions internally

When someone asks about getting started, guide them to:
1. Schedule a free consultation: virtualadmin@virtuallaborforce.com
2. Discuss their specific needs and challenges
3. Receive a custom proposal
4. Begin implementation

Remember: Be conversational, confident, and helpful. You represent a company that solves problems others can't.`;

// Function to call OpenAI API
async function getOpenAIResponse(messages) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: getSystemPrompt() },
                ...messages
            ],
            temperature: 0.7,
            max_tokens: 800
        });
        
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI API error:', error);
        throw new Error(`OpenAI API failed: ${error.message}`);
    }
}

// Function to call Ollama API
async function getOllamaResponse(messages) {
    try {
        const context = messages.map(msg => 
            `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n');
        
        const fullPrompt = `${getSystemPrompt()}\n\nConversation:\n${context}\n\nAssistant:`;
        
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama3.1:8b',
                prompt: fullPrompt,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.response.trim();
    } catch (error) {
        console.error('Ollama API error:', error);
        throw new Error(`Ollama API failed: ${error.message}`);
    }
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, conversationId } = req.body;
        
        // Get or create conversation history
        const history = conversations.get(conversationId) || [];
        
        // Add user message to history
        history.push({ role: 'user', content: message });
        
        let aiResponse;
        
        // Use OpenAI in production or if API key is available, otherwise use Ollama
        if (isProduction || (openai && process.env.OPENAI_API_KEY)) {
            console.log('Using OpenAI API...');
            aiResponse = await getOpenAIResponse(history);
        } else {
            console.log('Using Ollama (local)...');
            aiResponse = await getOllamaResponse(history);
        }
        
        // Add AI response to history
        history.push({ role: 'assistant', content: aiResponse });
        conversations.set(conversationId, history);
        
        res.json({ 
            response: aiResponse,
            conversationId: conversationId,
            source: isProduction || openai ? 'openai' : 'ollama'
        });
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: 'Failed to get AI response',
            details: error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'VLF Chatbot API is running',
        ai_provider: isProduction || openai ? 'OpenAI' : 'Ollama'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🤖 VLF Chatbot server running on http://localhost:${PORT}`);
    console.log(`🤖 AI Provider: ${isProduction || openai ? 'OpenAI (gpt-4o-mini)' : 'Ollama (llama3.1:8b)'}`);
    console.log(`📊 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`📊 API endpoints:`);
    console.log(`   - POST /api/chat - Send messages to chatbot`);
    console.log(`   - GET  /api/health - Check server status`);
});
