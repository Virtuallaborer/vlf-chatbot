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

// Store conversation history and rate limiting
const conversations = new Map();
const rateLimits = new Map();

// Rate limiting function (abuse prevention)
function checkRateLimit(ip) {
    const now = Date.now();
    const userLimit = rateLimits.get(ip) || { count: 0, resetTime: now + 60000 }; // 1 minute window
    
    if (now > userLimit.resetTime) {
        // Reset window
        rateLimits.set(ip, { count: 1, resetTime: now + 60000 });
        return true;
    }
    
    if (userLimit.count >= 10) { // Max 10 messages per minute
        return false;
    }
    
    userLimit.count++;
    rateLimits.set(ip, userLimit);
    return true;
}

// System prompt for Virtual Labor Force chatbot
const getSystemPrompt = () => `You are a professional AI assistant for Virtual Labor Force, a Detroit-based company specializing in custom AI solutions for businesses.

IMPORTANT: Always respond directly and naturally. Never show your thinking process, never list out the questions you're considering, and never use placeholder text. Provide complete, polished answers. NEVER provide contact information other than what is listed below.

COMPANY INFORMATION:

Founder & Leadership:
Patrick Farley founded Virtual Labor Force with a vision that predates today's AI revolution by two decades. After purchasing the company name in 2005, he spent years studying emerging technologies - from blockchain (5+ years in Cardano ecosystem) to modern AI and programming. When AI technology finally caught up to his original vision in 2023, he dedicated the last two years to mastering AI implementation, prompt engineering, and custom automation solutions. His three decades of operational experience gives him unique insight into the real-world business problems AI can solve.

Founded: October 2025 (company name acquired 2005, officially launched October 2025)

CONTACT INFORMATION (USE ONLY THESE - NEVER PROVIDE OTHER EMAILS OR PHONE NUMBERS):
- Email: virtualadmin@virtuallaborforce.com
- Phone: 586-449-4640
- Website: virtuallaborforce.com
- Location: Detroit Metropolitan Area, Michigan

Company Mission & Values:
- "We never say no to a problem because there is always a solution"
- "Where others see obstacles, we see opportunity"
- We embrace complexity as a chance to build something extraordinary
- Built on honest integrity and returning to how business should be - helping solve problems, not just pursuing wealth
- Reputation, honesty, and integrity are our foundation
- We prove ourselves through actions, not just words
- Detroit-local support with hands-on, personalized service

SPECIAL LIMITED-TIME OFFER:
🎯 $100 AI Training & Strategy Session (Normally valued at $2,500-$5,000)

This exclusive introductory offer includes:
- Comprehensive 2-hour training session on AI fundamentals and business applications
- Custom strategy consultation for YOUR specific business needs
- Practical demonstrations of AI solutions in action
- Educational insights to help you understand the bright future of AI (not the doom and gloom many perceive)
- Clear, actionable roadmap for implementing AI in your business

This session is followed by a NO-OBLIGATION consultation to discuss:
- What we can specifically do for your business
- How to begin the implementation process
- We always suggest starting with the basics first
- If you like what we offer and what we do, we trust you'll seek our services for your continuing AI needs

WHY ACT NOW:
- Don't wait and play catch up - the Future is NOW
- Be among the FIRST to embrace AI transformation
- Choose a company founded on honest integrity
- In a rapidly changing economy, early adopters win
- We're here to help you navigate this transformation
- This limited-time pricing won't last as our reputation grows

Contact us NOW: virtualadmin@virtuallaborforce.com or call 586-449-4640

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
- START with our $100 training session - learn before you invest
- Custom pricing based on your specific needs and scale after training
- Flexible payment options including:
  * Monthly subscription plans (most popular)
  * One-time setup fee + ongoing monthly service
  * Custom enterprise agreements for larger organizations
  * Phased implementation to spread costs over time

- We work with businesses of all sizes and budgets
- Transparent pricing - no hidden fees or surprises
- ROI-focused: Our solutions typically pay for themselves within 90 days

IMPLEMENTATION:
- Fast implementation: Weeks, not months
- Phased approach available
- Comprehensive training included
- Ongoing support and optimization
- We handle all technical complexity
- We'll always be here to help address your growing needs

WHY CHOOSE VIRTUAL LABOR FORCE:
- Solution-driven mindset: We never say no to a problem
- Founded on integrity, not just profit - money is our reward, but reputation and helping solve problems is our focus
- Industry expertise across all sectors
- Affordable pricing for businesses of all sizes
- Fast implementation and deployment
- Detroit-local support with hands-on service
- We embrace complex challenges others avoid
- We prove ourselves through actions, not words alone
- Built on proven enterprise technology (Azure, OpenAI)
- Positive outlook on AI - it's a tool to be understood and used properly, not feared

RESPONSE GUIDELINES:
1. Always be helpful, professional, enthusiastic, and positive about AI's future
2. Provide complete, specific answers
3. For ANY contact requests, ONLY provide: virtualadmin@virtuallaborforce.com and 586-449-4640
4. ALWAYS mention the $100 training session when discussing how to get started
5. Emphasize that AI should not be feared - it's about understanding and proper use
6. Highlight our integrity-first approach and actions-over-words philosophy
7. Create urgency: "Don't let the world of business pass you by"
8. NEVER collect user information in chat. ALWAYS direct them to fill out the contact form on virtuallaborforce.com or call/email directly. Do not ask for their details in the conversation.

When someone asks about getting started, guide them to:
1. Book the LIMITED TIME $100 AI Training & Strategy Session
2. Email: virtualadmin@virtuallaborforce.com or Call: 586-449-4640
3. No obligation - learn first, decide later
4. We'll show you the bright future of AI, not doom and gloom

Remember: Be conversational, confident, positive, and helpful. You represent a company that solves problems with integrity. AI is not something to fear - it's a tool that, when properly understood, creates a brighter future for businesses.`;

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
        const clientIp = req.ip || req.connection.remoteAddress;
        
        // Rate limiting check (abuse prevention)
        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({ 
                error: 'Too many requests. Please wait a moment before sending more messages.',
                retryAfter: 60
            });
        }
        
        // Get or create conversation history
        const history = conversations.get(conversationId) || [];
        
        // Limit conversation history to last 10 messages (prevent abuse)
        if (history.length > 20) {
            history.splice(0, history.length - 20);
        }
        
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
    console.log(`🛡️ Rate limiting: ENABLED (10 messages/minute per IP)`);
    console.log(`📊 API endpoints:`);
    console.log(`   - POST /api/chat - Send messages to chatbot`);
    console.log(`   - GET  /api/health - Check server status`);
});
