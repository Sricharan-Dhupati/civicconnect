import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Enhanced helper function to get comprehensive user data
const getUserComplaintData = async (supabase: any, userId: string) => {
  try {
    // Get user's issues with detailed analysis
    const { data: issues, error: issuesError } = await supabase
      .from('issues')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (issuesError) {
      console.error('Error fetching user issues:', issuesError);
      return { issues: [], suggestions: [], totalIssues: 0 };
    }

    // Get user's suggestions
    const { data: suggestions, error: suggestionsError } = await supabase
      .from('suggestions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Analyze complaint patterns and statistics
    const pendingIssues = issues?.filter(i => i.status === 'reported') || [];
    const inProgressIssues = issues?.filter(i => i.status === 'in_progress') || [];
    const resolvedIssues = issues?.filter(i => i.status === 'resolved') || [];
    
    // Category breakdown
    const categoryStats = issues?.reduce((acc: any, issue: any) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    }, {}) || {};

    // Priority breakdown
    const priorityStats = issues?.reduce((acc: any, issue: any) => {
      acc[issue.priority] = (acc[issue.priority] || 0) + 1;
      return acc;
    }, {}) || {};

    return {
      issues: issues || [],
      suggestions: suggestions || [],
      totalIssues: issues?.length || 0,
      recentIssue: issues?.[0] || null,
      pendingIssues: pendingIssues.length,
      inProgressIssues: inProgressIssues.length,
      resolvedIssues: resolvedIssues.length,
      categoryStats,
      priorityStats,
      pendingList: pendingIssues.slice(0, 3),
      resolvedList: resolvedIssues.slice(0, 3),
      hasImages: issues?.some(i => i.image_url) || false,
      avgResponseTime: resolvedIssues.length > 0 ? '3-5 days' : 'No data yet'
    };
  } catch (error) {
    console.error('Error in getUserComplaintData:', error);
    return { issues: [], suggestions: [], totalIssues: 0 };
  }
};

// Feature-aware FAQ knowledge base
const getFeatureAwareFAQ = (message: string, userData: any = null): string | null => {
  const lowerMessage = message.toLowerCase();
  
  // Website feature-specific questions
  const featureQuestions = [
    {
      keywords: ['status tracker', 'where find status', 'track location', 'dashboard', 'find tracker'],
      response: `📍 **Finding the Status Tracker:**

The Status Tracker is located in your **main dashboard** under the "My Reports" section. Here's exactly how to find it:

1. 🏠 Go to the main dashboard (home page)
2. 📊 Look for "My Reports" in the navigation menu
3. 🔍 Click on "My Reports" to see all your complaints
4. 📈 Each complaint shows its current status with color coding

**Status Colors:**
• 🔴 Red = Pending (just submitted)
• 🟡 Yellow = In Progress (being worked on)
• 🟢 Green = Resolved (completed)

You can also bookmark the My Reports page for quick access! The URL is available in your browser after clicking the section.`
    },
    {
      keywords: ['upload image', 'attach photo', 'add picture', 'image support', 'photo upload'],
      response: `📸 **Image Upload Feature:**

Yes! You can **attach images** when submitting complaints to help authorities understand the issue better.

**How to Upload Images:**
1. 📝 When filling out the complaint form
2. 📎 Look for the "Upload Images" section
3. 🖼️ Click "Choose Files" or drag & drop images
4. ✅ Supports JPG, PNG, and other common formats
5. 📏 Maximum 5MB per image, up to 3 images per complaint

**Pro Tips:**
• 📐 Take clear, well-lit photos from multiple angles
• 🏷️ Include close-ups of the problem area
• 📍 Wide shots showing location context help too
• 🚫 Avoid blurry or poorly lit images

Images significantly improve resolution speed - authorities can see exactly what needs fixing! 🎯`
    },
    {
      keywords: ['voice to text', 'voice input', 'speak', 'microphone', 'illiterate', 'audio input'],
      response: `🎤 **Voice-to-Text Feature:**

Great question! We have **voice input support** to help users who prefer speaking over typing.

**How to Use Voice Input:**
1. 🗣️ Look for the microphone icon (🎤) in complaint forms and chat
2. 📱 Click the microphone button to start recording
3. 🔊 Speak clearly in Telugu, Hindi, or English
4. ⏹️ Click stop when finished - text appears automatically
5. ✏️ Review and edit the text if needed before submitting

**Accessibility Features:**
• 🌐 Supports multiple Indian languages
• 👂 Works well in noisy environments
• 🔄 Can re-record if not satisfied
• 📝 Combines with regular typing if needed

This feature is especially helpful for elderly users or those who prefer speaking. The system is quite accurate with clear speech! 🎯`
    },
    {
      keywords: ['anonymous', 'private complaint', 'hide identity', 'confidential', 'secret reporting'],
      response: `🔒 **Anonymous Complaint Feature:**

Yes! You can file **completely anonymous complaints** to protect your identity, especially important for corruption cases.

**How Anonymous Reporting Works:**
1. ✅ Check "File Anonymous Complaint" during submission
2. 🛡️ Your name and contact details are hidden from public view
3. 🔐 Only the complaint content and location are visible
4. 📧 You'll still get a tracking ID via email for follow-up

**Privacy Protection:**
• 🚫 Your personal details never appear in public records
• 🏛️ Authorities see only the complaint details they need
• 📱 Phone number is optional for anonymous reports
• 🔒 All data is encrypted and secure

**Best for:**
• 💰 Corruption complaints against officials
• 🚨 Whistleblowing situations
• 🏠 Neighborhood disputes where you prefer privacy

Your safety and privacy come first! 🛡️`
    },
    {
      keywords: ['complaint categories', 'issue types', 'what can report', 'report types'],
      response: `🏢 **Available Complaint Categories:**

Our system handles these main categories, each routed to the right authority:

**🏙️ Municipal Services:**
• 🚧 **Roads & Infrastructure** → GHMC Road Dept
• 💧 **Water Supply Issues** → Water Board
• 🗑️ **Waste Management** → Sanitation Dept  
• ⚡ **Electricity Problems** → Electricity Board
• 🚰 **Drainage & Sewage** → Engineering Dept

**💰 Governance & Corruption:**
• 🤝 **Bribery Cases** → Anti-Corruption Bureau
• 📄 **Document Delays** → Revenue Department
• ⚖️ **Misuse of Funds** → Vigilance Department

**🚨 Safety & Security:**
• 🔒 **Street Safety** → Police Department
• 🚦 **Traffic Issues** → Traffic Police
• 🎵 **Noise Pollution** → Pollution Board

Each category automatically goes to the right department - no need to figure out who to contact! 🎯`
    },
    {
      keywords: ['notifications', 'alerts', 'sms updates', 'email updates', 'how get notified'],
      response: `🔔 **Notification System:**

You'll receive **automatic updates** about your complaints through multiple channels:

**📱 SMS Notifications:**
• Instant confirmation when complaint is submitted
• Status change alerts (Pending → In Progress → Resolved)
• Authority contact info for urgent issues
• Final resolution confirmation

**📧 Email Updates:**
• Detailed status reports with authority responses
• Weekly summary of all your complaints
• Document attachments if authorities provide them
• Escalation instructions if delays occur

**🌐 In-App Notifications:**
• Real-time updates when you visit the website
• Red badge showing new updates in "My Reports"
• Chatbot can also tell you about recent changes

**⚙️ Manage Preferences:**
• Go to Settings → Notifications
• Choose SMS, email, or both
• Set frequency (immediate, daily, weekly)
• Turn off non-critical updates if desired

Never miss an update on your complaints! 📬`
    },
    {
      keywords: ['ai features', 'smart suggestions', 'auto category', 'ai help'],
      response: `🤖 **AI-Powered Features:**

Our system uses AI to make complaint reporting smarter and faster:

**🎯 Smart Categorization:**
• AI automatically suggests the best category for your complaint
• Analyzes your description to recommend priority level
• Identifies the right authority to handle your issue

**💡 Intelligent Suggestions:**
• Real-time writing tips while you type your complaint
• Location auto-complete based on your input
• Similar resolved cases shown for reference

**🔍 Enhanced Search:**
• Ask me questions like "How many road complaints are pending?"
• Search your complaints by speaking naturally
• Get insights about complaint patterns in your area

**📊 Predictive Analytics:**
• Estimated resolution time based on similar cases
• Best time to submit for faster response
• Success rate predictions for different issue types

**🗣️ Conversational Interface:**
• Chat with me in natural language
• Get step-by-step guidance when needed
• Voice-to-text powered by AI recognition

The AI learns from successful resolutions to help everyone get better results! 🚀`
    }
  ];

  // Check for feature-specific questions
  for (const faq of featureQuestions) {
    if (faq.keywords.some(keyword => lowerMessage.includes(keyword))) {
      return faq.response;
    }
  }

  return null;
};

// Enhanced context-aware response function with natural language processing
const getContextualResponse = async (message: string, userData: any, supabase: any, userId?: string): Promise<string> => {
  const lowerMessage = message.toLowerCase();
  
  // First check for feature-aware FAQ responses
  const featureFAQ = getFeatureAwareFAQ(message, userData);
  if (featureFAQ) {
    return featureFAQ;
  }

  // Handle user-specific queries with data
  if (userId) {
    const userComplaintData = await getUserComplaintData(supabase, userId);
    
    // Status and tracking queries
    if (lowerMessage.includes('status') || lowerMessage.includes('track') || lowerMessage.includes('my complaint')) {
      if (userComplaintData.totalIssues === 0) {
        return `🔍 **Your Complaint Status:**

You haven't submitted any complaints yet! Let me help you get started.

**Quick Actions:**
• 📝 Click "Report Issues" to submit your first complaint
• 🎤 Use voice input if you prefer speaking
• 📸 Upload photos to help authorities understand the issue better

**Pro Tip:** The Status Tracker is located in "My Reports" on your dashboard - bookmark it for easy access once you have complaints! 🎯

What issue would you like to report today?`;
      }

      return `📊 **Your Current Status Overview:**

**📈 Summary:** ${userComplaintData.totalIssues} total complaints
• 🔴 **${userComplaintData.pendingIssues} Pending** (awaiting review)
• 🟡 **${userComplaintData.inProgressIssues} In Progress** (being resolved)  
• 🟢 **${userComplaintData.resolvedIssues} Resolved** (completed)

${userComplaintData.recentIssue ? `**🔍 Latest:** "${userComplaintData.recentIssue.title}" (${userComplaintData.recentIssue.status}) - ${userComplaintData.recentIssue.category}` : ''}

**🔍 To see detailed status:** Go to "My Reports" in your dashboard - that's where the Status Tracker lives!

${userComplaintData.pendingIssues > 0 ? `💡 **Your pending complaints** are being reviewed. Average response time: ${userComplaintData.avgResponseTime}.` : ''}

Need help with anything specific? 😊`;
    }

    // Resolved issues query
    if (lowerMessage.includes('resolved') || lowerMessage.includes('completed') || lowerMessage.includes('fixed')) {
      if (userComplaintData.resolvedIssues === 0) {
        return `✅ **Your Resolved Complaints:**

You don't have any resolved complaints yet. ${userComplaintData.pendingIssues > 0 ? `But you have ${userComplaintData.pendingIssues} pending complaints being worked on!` : 'No complaints submitted yet.'}

${userComplaintData.pendingIssues > 0 ? `**⏰ Estimated resolution:** Most complaints in your categories resolve within ${userComplaintData.avgResponseTime}.` : ''}

${userComplaintData.totalIssues === 0 ? 'Ready to report an issue? I can guide you through the process!' : 'Your pending complaints will appear here once authorities resolve them.'}`;
      }

      let resolvedResponse = `✅ **Your Resolved Complaints (${userComplaintData.resolvedIssues}):**\n\n`;
      
      userComplaintData.resolvedList.forEach((issue: any, index: number) => {
        resolvedResponse += `${index + 1}. **${issue.title}**\n`;
        resolvedResponse += `   Category: ${issue.category} | Priority: ${issue.priority}\n`;
        resolvedResponse += `   Resolved: ${new Date(issue.updated_at).toLocaleDateString()}\n\n`;
      });

      if (userComplaintData.resolvedIssues > 3) {
        resolvedResponse += `...and ${userComplaintData.resolvedIssues - 3} more resolved complaints.\n\n`;
      }

      resolvedResponse += `🎯 **Success Rate:** Great job! These issues are now fixed thanks to your reporting.`;
      
      return resolvedResponse;
    }

    // Pending count query  
    if (lowerMessage.includes('pending') || lowerMessage.includes('how many')) {
      if (userComplaintData.pendingIssues === 0) {
        return `📊 **Pending Complaints Count:** 

You have **0 pending complaints** right now! ${userComplaintData.totalIssues > 0 ? `All your ${userComplaintData.totalIssues} complaints have been processed.` : 'No complaints submitted yet.'}

${userComplaintData.resolvedIssues > 0 ? `🎉 **Great news:** ${userComplaintData.resolvedIssues} of your complaints have been resolved!` : ''}

Ready to report a new issue? I'm here to help! 🚀`;
      }

      let pendingResponse = `⏳ **Your Pending Complaints (${userComplaintData.pendingIssues}):**\n\n`;
      
      userComplaintData.pendingList.forEach((issue: any, index: number) => {
        const daysPending = Math.floor((Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24));
        pendingResponse += `${index + 1}. **${issue.title}** (${issue.category})\n`;
        pendingResponse += `   Priority: ${issue.priority} | Submitted: ${daysPending} days ago\n\n`;
      });

      pendingResponse += `💡 **Status Check:** Go to "My Reports" in your dashboard for real-time updates on these complaints.

⚡ **Average resolution time** for ${Object.keys(userComplaintData.categoryStats)[0] || 'your issues'}: ${userComplaintData.avgResponseTime}`;

      return pendingResponse;
    }

    // Category-specific queries
    if (lowerMessage.includes('road') || lowerMessage.includes('water') || lowerMessage.includes('waste')) {
      const categoryMap: any = {
        'road': 'Roads',
        'water': 'Water Supply', 
        'waste': 'Waste Management',
        'electric': 'Electricity',
        'drainage': 'Drainage'
      };
      
      const queriedCategory = Object.keys(categoryMap).find(cat => lowerMessage.includes(cat));
      if (queriedCategory && userComplaintData.categoryStats[categoryMap[queriedCategory]]) {
        const count = userComplaintData.categoryStats[categoryMap[queriedCategory]];
        return `📊 **Your ${categoryMap[queriedCategory]} Complaints:**

You've reported **${count} ${categoryMap[queriedCategory].toLowerCase()} issue(s)**.

**🔍 To see details:** Check "My Reports" → Filter by "${categoryMap[queriedCategory]}" category.

**📞 Relevant Authority:** 
${queriedCategory === 'road' ? '• GHMC Road Department: 155304' : 
  queriedCategory === 'water' ? '• Hyderabad Water Board: 155313' :
  queriedCategory === 'waste' ? '• GHMC Sanitation: 155304' :
  '• Check the complaint details for authority contact info'}

Need help with a new ${queriedCategory} issue? I can guide you through reporting it! 🛠️`;
      }
    }
  }

  // Fallback to general FAQ responses
  return getFallbackResponse(message);
};

// Enhanced FAQ patterns with more specific responses
const getFallbackResponse = (message: string): string => {
  const lowerMessage = message.toLowerCase();
  
  // FAQ patterns and responses
  const faqPatterns = [
    {
      keywords: ['submit', 'report', 'complaint', 'issue', 'how to', 'file'],
      response: `📝 **How to Submit a Complaint - Step by Step:**

**📱 Quick Method:**
1. Click "Report Issues" in the main dashboard
2. Select category: 🚧 Roads, 💧 Water, 🗑️ Waste, ⚡ Electricity, 🚰 Drainage
3. Describe the problem clearly
4. Add location (district/pincode/landmark)
5. Upload photos (helps get faster resolution!)
6. Submit and get your tracking ID

**💬 AI-Assisted Method:**
• Type "report an issue" here for step-by-step guidance
• I'll help categorize and prioritize your complaint
• Get tips for writing effective descriptions

**⚡ Pro Tips:**
• Include specific location details
• Mention safety concerns for higher priority
• Add multiple photos from different angles

Ready to start? Click "Report Issue" above! 🚀`
    },
    {
      keywords: ['track', 'status', 'follow', 'check', 'my complaint', 'progress'],
      response: `📊 **How to Track Your Complaint Status:**

**📲 Multiple Ways to Track:**
1. **Dashboard**: Go to "My Reports" section
2. **Chatbot**: Ask me "track my complaints" or "my status"
3. **SMS/Email**: Automatic updates sent to you
4. **Tracking ID**: Use it on the status page

**📈 Status Meanings:**
• 🔄 **Pending**: Complaint received, being reviewed
• ⚙️ **In Progress**: Authority is actively working on it
• ✅ **Resolved**: Issue has been fixed/addressed
• ❌ **Rejected**: Not within scope (rare, with explanation)

**⏰ Typical Timeline:**
• Municipal issues: 3-7 business days
• Corruption cases: 7-15 business days
• Emergency issues: Same day response

**🔔 Get Notified:**
• Status changes trigger automatic SMS/email
• Critical updates sent immediately
• Weekly summary for pending issues

Try asking me "track my complaints" to see your personalized status! 📱`
    },
    {
      keywords: ['edit', 'update', 'change', 'modify', 'delete', 'remove'],
      response: `✏️ **Managing Your Complaints:**

**📝 Editing Complaints:**
• Go to "My Reports" section
• Click on any complaint to view details
• Use "Edit" button to modify description, add photos
• Cannot change category after submission (prevents misuse)

**🗑️ Deleting Complaints:**
• Only possible within 24 hours of submission
• Click "Delete" in complaint details
• Permanent action - cannot be undone
• Alternative: Add clarification instead of deleting

**🔄 Adding Updates:**
• Use "Add Update" to provide new information
• Upload additional photos or evidence
• Clarify location or severity
• These updates help authorities resolve faster

**⚠️ Important Notes:**
• Fraudulent complaints may lead to account suspension
• Major changes require creating a new complaint
• Authority responses cannot be edited (but you can reply)

**💡 Best Practice:**
Instead of deleting, add updates with corrections! This maintains the complete history for authorities. 📚`
    },
    {
      keywords: ['authority', 'contact', 'phone', 'email', 'office', 'help', 'support'],
      response: `📞 **Contact Information & Authorities:**

**🏛️ Municipal Issues:**
• **GHMC**: 155304 | commissioner-ghmc@gov.in
• **Water Board**: 155313 | customercare@hyderabadwater.gov.in
• **Electricity**: 1912 | complaint@tssouthernpower.com
• **Traffic**: 9010203626 | traffic.hyd@tspolice.gov.in

**🔒 Corruption Cases:**
• **ACB Telangana**: 040-2325-1555 | dg_acb@telangana.gov.in
• **Vigilance**: 040-2346-1151 | vigilance@telangana.gov.in
• **Lokayukta**: 040-2332-4621 | info@tslokayukta.gov.in

**🚨 Emergency Contacts:**
• Fire: 101 | Ambulance: 108 | Police: 100
• Disaster: 040-2345-3456 | Women Helpline: 181

**💬 Platform Support:**
• Technical issues: Use this chatbot
• Account problems: Ask me "account help"
• Report bugs: Describe the issue here

**⚡ Quick Response Tips:**
• For urgent issues: Call first, then file complaint
• Use WhatsApp numbers for faster response
• Mention complaint ID when calling authorities

Need help with something specific? Just ask! 🤝`
    },
    {
      keywords: ['category', 'type', 'issues', 'what can report', 'kind'],
      response: `🏢 **Complete Issue Categories & Examples:**

**🏙️ Municipal Services:**
• 🚧 **Roads**: Potholes, broken footpaths, traffic signals
• 💧 **Water**: Leakage, shortage, contamination, billing
• 🗑️ **Waste**: Garbage collection, illegal dumping, overflowing bins
• ⚡ **Electricity**: Streetlight issues, power cuts, billing disputes
• 🚰 **Drainage**: Blockages, overflow, manholes, stagnant water
• 🌳 **Parks**: Maintenance, encroachment, damaged equipment

**💰 Corruption & Governance:**
• 🤝 Bribery in government offices
• 📄 Document processing delays/demands
• ⚖️ Misuse of public funds
• 🏛️ Abuse of power by officials
• 🎯 Favoritism in public services

**🚨 Safety & Security:**
• 🔒 Street safety, lighting issues
• 🚦 Traffic violations, illegal parking
• 🏗️ Unauthorized construction
• 🎵 Noise pollution, illegal events

**✅ What Gets Resolved Fastest:**
• Issues with photos/evidence
• Clear location details
• Safety-related problems
• Multiple citizen reports on same issue

**❌ What We Cannot Handle:**
• Private disputes between individuals
• Court cases or legal matters
• Central government issues

Each category automatically routes to the right authority! 🎯`
    },
    {
      keywords: ['anonymous', 'privacy', 'identity', 'confidential', 'secret'],
      response: `🔒 **Privacy & Anonymous Reporting:**

**🛡️ Your Privacy is Protected:**
• End-to-end encryption for all data
• Identity shared only with relevant authorities when needed
• Option to file completely anonymous complaints
• IP address and device info not stored with complaints

**👤 Anonymous Reporting Options:**
• Check "Anonymous" during complaint submission
• Use generic email for account (not required to be real name)
• Phone number optional for anonymous reports
• No personal details shared in public complaint tracking

**🔐 Data Security Measures:**
• All personal data encrypted at rest
• Secure transmission protocols (HTTPS/TLS)
• Authority access logged and audited
• Automatic data deletion after case closure

**⚠️ When Identity May Be Needed:**
• Corruption cases requiring witness testimony
• Legal proceedings initiated by authorities
• Follow-up investigations requiring clarification
• Court orders (rare, with legal notice)

**💡 Best Practices for Anonymity:**
• Use general location descriptions
• Avoid mentioning personal relationships
• Focus on facts, not opinions
• Use separate email for sensitive reports

**🚨 Special Protection for Whistleblowers:**
• Extra security for corruption reports
• Direct channels to senior authorities
• Legal protection under Whistleblower Act
• 24/7 support for serious cases

Your safety comes first! 🛡️`
    }
  ];

  // Enhanced pattern matching
  for (const faq of faqPatterns) {
    if (faq.keywords.some(keyword => lowerMessage.includes(keyword))) {
      return faq.response;
    }
  }

  // More specific default responses based on context
  if (lowerMessage.includes('help') || lowerMessage.includes('support')) {
    return `🤖 **How I Can Help You:**

**🎯 Main Functions:**
• 📝 Guide you through complaint submission
• 📊 Track your complaint status in real-time
• 🏢 Explain issue categories and authorities
• 📞 Provide contact information and escalation paths
• 💡 Give tips for effective complaint writing

**💬 Try These Commands:**
• "Track my complaints" - See your personalized status
• "Report an issue" - Step-by-step guidance
• "Contact info for water problems" - Get specific authority details
• "How to write effective complaints" - Pro tips
• "My complaint history" - View all your submissions

**🚀 Quick Actions:**
• Click "Report Issue" above for guided submission
• Ask specific questions about your area of concern
• Request escalation help for unresolved issues

**📱 Available 24/7:**
I'm here anytime you need help with civic issues in Telangana! What would you like assistance with? 😊`;
  }

  // Default comprehensive response
  return `🤖 **Welcome to Your AI Civic Assistant!**

**🎯 I'm specialized in helping with:**
• 📝 **Complaint Reporting**: Step-by-step guidance for all issue types
• 📊 **Status Tracking**: Real-time updates on your submissions
• 🏢 **Authority Information**: Know exactly who handles what
• 💬 **Process Guidance**: Navigate civic services efficiently
• 🔍 **Personal Dashboard**: Track your complaint history

**🚀 Quick Start Options:**
• Type "report an issue" for guided submission
• Ask "track my complaints" for personalized status
• Say "help with [specific issue]" for targeted assistance
• Click "Report Issue" button above for immediate help

**💡 Popular Queries:**
• "How to report a pothole?"
• "Water supply complaint procedure"
• "Track complaint status"
• "Corruption reporting process"
• "Contact information for authorities"

**🌟 Pro Tips:**
• Be specific about locations
• Include photos when possible
• Use this chat for real-time guidance
• Check your email/SMS for status updates

Ready to make your city better? What issue would you like to address today? 🏙️✨`;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { message, conversationId, userId } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    console.log('Received message:', message, 'User ID:', userId);

    // Get user data if userId is provided
    let userData = null;
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      userData = profile;
    }

    let aiResponse: string;

    // Try OpenAI API first
    if (openAIApiKey) {
      try {
        // Get rich contextual information for AI responses
        let contextualInfo = '';
        if (userId) {
          const userComplaintData = await getUserComplaintData(supabase, userId);
          contextualInfo = `

User Context & Website Features:
- Total complaints: ${userComplaintData.totalIssues} (${userComplaintData.pendingIssues} pending, ${userComplaintData.inProgressIssues} in progress, ${userComplaintData.resolvedIssues} resolved)
- Categories used: ${Object.keys(userComplaintData.categoryStats).join(', ')}
- Has uploaded images: ${userComplaintData.hasImages ? 'Yes' : 'No'}
- Average resolution time: ${userComplaintData.avgResponseTime}
- Most recent: ${userComplaintData.recentIssue ? `"${userComplaintData.recentIssue.title}" (${userComplaintData.recentIssue.status})` : 'None'}

Website Features Available:
- Status Tracker: Located in "My Reports" section of dashboard
- Image Upload: Supported during complaint submission (JPG, PNG, up to 5MB)
- Voice-to-Text: Microphone icon available for speaking complaints
- Anonymous Reporting: Option available for sensitive complaints
- SMS/Email Notifications: Automatic updates sent to users
- AI Features: Smart categorization, predictive analytics, conversational interface`;
        }

        const systemPrompt = `You are an advanced AI assistant for the "Civic Crowdsourced Reporting System" in Telangana. You are feature-aware and data-connected.

Your capabilities:
1. Answer questions about website features (Status Tracker location, image upload, voice input, etc.)
2. Provide personalized complaint status using real user data
3. Help users navigate the platform efficiently
4. Guide through complaint reporting with smart suggestions
5. Give natural, conversational responses (not just step-by-step instructions)
6. Connect users to the right authorities with specific contact information

Key Features to Reference:
- Status Tracker: In "My Reports" dashboard section
- Image Upload: Available during complaint submission (5MB limit, multiple formats)
- Voice-to-Text: Microphone icon for audio input
- Anonymous Mode: For sensitive/corruption complaints
- Smart Categorization: AI suggests categories and priorities
- Real-time Notifications: SMS/Email updates on status changes

Authorities:
- Municipal: GHMC (155304), Water Board (155313), Electricity (1912)
- Corruption: ACB Telangana (040-2325-1555), Vigilance (040-2346-1151)

Be conversational, helpful, and specific. Use user data when available. Avoid generic responses - tailor answers to the actual question and context.${contextualInfo}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message }
            ],
            max_tokens: 600,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('OpenAI API error:', errorData);
          throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        aiResponse = data.choices[0].message.content;

        console.log('AI Response:', aiResponse);
      } catch (openAIError) {
        console.error('OpenAI failed, using contextual fallback:', openAIError);
        aiResponse = await getContextualResponse(message, userData, supabase, userId);
      }
    } else {
      // Use contextual fallback responses when no OpenAI key
      console.log('No OpenAI key found, using contextual fallback responses');
      aiResponse = await getContextualResponse(message, userData, supabase, userId);
    }

    return new Response(JSON.stringify({ 
      response: aiResponse,
      conversationId: conversationId || `conv_${Date.now()}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-chatbot function:', error);
    
    // Always provide a meaningful fallback response
    const fallbackResponse = await getContextualResponse('help', null, null, null);
    
    return new Response(JSON.stringify({ 
      response: fallbackResponse,
      conversationId: `conv_${Date.now()}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});