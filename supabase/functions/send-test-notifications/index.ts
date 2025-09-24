import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// SMS service configuration (using a mock service for demonstration)
const sendSMS = async (phoneNumber: string, message: string): Promise<boolean> => {
  try {
    console.log(`Sending SMS to ${phoneNumber}: ${message}`);
    
    // In a real implementation, you would use a service like Twilio, AWS SNS, or local SMS gateway
    // For now, we'll simulate the SMS sending
    const smsPayload = {
      to: phoneNumber,
      message: message,
      from: 'CivicConnect'
    };

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('SMS sent successfully:', smsPayload);
    return true;
  } catch (error) {
    console.error('SMS sending failed:', error);
    return false;
  }
};

// Email service using a simple SMTP approach
const sendEmail = async (toEmail: string, subject: string, htmlContent: string): Promise<boolean> => {
  try {
    console.log(`Sending email to ${toEmail}: ${subject}`);
    
    // In a real implementation, you would use services like:
    // - SendGrid, Mailgun, AWS SES, or Resend
    // - Or SMTP with nodemailer
    
    const emailPayload = {
      to: toEmail,
      subject: subject,
      html: htmlContent,
      from: 'noreply@civicconnect.com'
    };

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('Email sent successfully:', emailPayload);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
};

const formatReportForSMS = (report: any): string => {
  return `🚨 CivicConnect Test Report
Title: ${report.title}
Category: ${report.category}
Location: ${report.location || 'Not specified'}
Priority: ${report.priority}
Description: ${report.description.substring(0, 100)}${report.description.length > 100 ? '...' : ''}
Reported: ${new Date(report.created_at).toLocaleString()}
ID: ${report.id}`;
};

const formatReportForEmail = (report: any): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CivicConnect Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3b82f6, #06b6d4); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #1e40af; }
    .value { margin-top: 5px; }
    .priority-high { color: #dc2626; font-weight: bold; }
    .priority-medium { color: #d97706; font-weight: bold; }
    .priority-low { color: #059669; font-weight: bold; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 CivicConnect Test Report</h1>
      <p>New civic issue reported through the test category</p>
    </div>
    
    <div class="content">
      <div class="field">
        <div class="label">Report ID:</div>
        <div class="value"><code>${report.id}</code></div>
      </div>
      
      <div class="field">
        <div class="label">Title:</div>
        <div class="value">${report.title}</div>
      </div>
      
      <div class="field">
        <div class="label">Category:</div>
        <div class="value">${report.category}</div>
      </div>
      
      <div class="field">
        <div class="label">Priority:</div>
        <div class="value priority-${report.priority}">${report.priority.toUpperCase()}</div>
      </div>
      
      <div class="field">
        <div class="label">Location:</div>
        <div class="value">${report.location || 'Not specified'}</div>
      </div>
      
      <div class="field">
        <div class="label">Description:</div>
        <div class="value">${report.description}</div>
      </div>
      
      <div class="field">
        <div class="label">Reported At:</div>
        <div class="value">${new Date(report.created_at).toLocaleString()}</div>
      </div>
      
      ${report.image_url ? `
      <div class="field">
        <div class="label">Attached Image:</div>
        <div class="value"><a href="${report.image_url}" target="_blank">View Image</a></div>
      </div>
      ` : ''}
    </div>
    
    <div class="footer">
      <p>This is an automated notification from CivicConnect Test Category</p>
      <p>Please do not reply to this email</p>
    </div>
  </div>
</body>
</html>`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportData } = await req.json();

    if (!reportData) {
      throw new Error('Report data is required');
    }

    console.log('Processing test category notification for report:', reportData.id);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Target contact information
    const targetPhone = '+91 8519890805';
    const targetEmail = 'sricharan.dhupati@gmail.com';

    // Prepare notification content
    const smsContent = formatReportForSMS(reportData);
    const emailSubject = `🚨 CivicConnect Test Report: ${reportData.title}`;
    const emailContent = formatReportForEmail(reportData);

    // Send notifications concurrently
    const [smsResult, emailResult] = await Promise.allSettled([
      sendSMS(targetPhone, smsContent),
      sendEmail(targetEmail, emailSubject, emailContent)
    ]);

    // Check results
    const smsSuccess = smsResult.status === 'fulfilled' && smsResult.value;
    const emailSuccess = emailResult.status === 'fulfilled' && emailResult.value;

    // Log results
    console.log('SMS Result:', smsSuccess ? 'SUCCESS' : 'FAILED');
    console.log('Email Result:', emailSuccess ? 'SUCCESS' : 'FAILED');

    // Store notification log in database (optional)
    try {
      await supabase.from('notification_logs').insert({
        issue_id: reportData.id,
        notification_type: 'test_category',
        sms_sent: smsSuccess,
        email_sent: emailSuccess,
        target_phone: targetPhone,
        target_email: targetEmail,
        sent_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Failed to log notification:', logError);
      // Don't fail the main operation if logging fails
    }

    return new Response(JSON.stringify({
      success: true,
      sms_sent: smsSuccess,
      email_sent: emailSuccess,
      target_phone: targetPhone,
      target_email: targetEmail,
      message: `Notifications sent - SMS: ${smsSuccess ? 'SUCCESS' : 'FAILED'}, Email: ${emailSuccess ? 'SUCCESS' : 'FAILED'}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-test-notifications function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Notification sending failed',
      sms_sent: false,
      email_sent: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});