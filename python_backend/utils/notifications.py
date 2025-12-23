"""
Notification System for Price Alerts
Supports Slack and Email notifications
"""
from typing import List, Dict, Optional
from datetime import datetime
from decimal import Decimal

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from loguru import logger

from python_backend.config.config import settings


class SlackNotifier:
    """
    Send notifications to Slack
    """

    def __init__(self):
        self.webhook_url = settings.SLACK_WEBHOOK_URL
        self.bot_token = settings.SLACK_BOT_TOKEN
        self.channel = settings.SLACK_CHANNEL
        self.client = None

        if self.bot_token:
            self.client = WebClient(token=self.bot_token)

    def send_price_alert(
        self,
        watch_info: Dict,
        alert_type: str,
        price_data: Dict
    ) -> bool:
        """
        Send price alert to Slack

        Args:
            watch_info: Dictionary with watch details
            alert_type: 'price_drop', 'opportunity', 'below_threshold'
            price_data: Price information

        Returns:
            True if successful
        """
        try:
            message = self._format_price_alert(watch_info, alert_type, price_data)

            if self.client:
                response = self.client.chat_postMessage(
                    channel=self.channel,
                    text=message,
                    blocks=self._create_alert_blocks(watch_info, alert_type, price_data)
                )
                logger.info(f"Slack alert sent successfully: {response['ts']}")
                return True
            else:
                logger.warning("Slack client not configured")
                return False

        except SlackApiError as e:
            logger.error(f"Slack API error: {e.response['error']}")
            return False
        except Exception as e:
            logger.error(f"Error sending Slack alert: {e}")
            return False

    def send_opportunity_alert(self, opportunities: List[Dict]) -> bool:
        """
        Send opportunity summary to Slack

        Args:
            opportunities: List of opportunity dictionaries

        Returns:
            True if successful
        """
        try:
            if not opportunities:
                return True

            message = self._format_opportunity_summary(opportunities)

            if self.client:
                response = self.client.chat_postMessage(
                    channel=self.channel,
                    text=message,
                    blocks=self._create_opportunity_blocks(opportunities)
                )
                logger.info(f"Opportunity alert sent to Slack")
                return True
            else:
                logger.warning("Slack client not configured")
                return False

        except Exception as e:
            logger.error(f"Error sending opportunity alert: {e}")
            return False

    def _format_price_alert(
        self,
        watch_info: Dict,
        alert_type: str,
        price_data: Dict
    ) -> str:
        """Format price alert message"""
        brand = watch_info.get('brand', 'Unknown')
        reference = watch_info.get('reference_number', 'Unknown')
        current_price = price_data.get('current_price', 0)

        if alert_type == 'price_drop':
            previous_price = price_data.get('previous_price', 0)
            drop_percent = price_data.get('drop_percent', 0)
            return f"""
🚨 *PRICE DROP ALERT*

{brand} {reference}
Previous Price: ${previous_price:,.2f}
Current Price: ${current_price:,.2f}
Drop: {drop_percent:.1f}%
            """.strip()

        elif alert_type == 'opportunity':
            avg_price = price_data.get('average_price', 0)
            discount = price_data.get('discount_percent', 0)
            return f"""
🎯 *BUYING OPPORTUNITY*

{brand} {reference}
Current Price: ${current_price:,.2f}
Market Average: ${avg_price:,.2f}
Discount: {discount:.1f}%
            """.strip()

        elif alert_type == 'below_threshold':
            threshold = price_data.get('threshold', 0)
            return f"""
✅ *PRICE BELOW THRESHOLD*

{brand} {reference}
Current Price: ${current_price:,.2f}
Your Threshold: ${threshold:,.2f}
            """.strip()

        return f"Price alert for {brand} {reference}"

    def _create_alert_blocks(
        self,
        watch_info: Dict,
        alert_type: str,
        price_data: Dict
    ) -> List[Dict]:
        """Create Slack blocks for rich formatting"""
        brand = watch_info.get('brand', 'Unknown')
        reference = watch_info.get('reference_number', 'Unknown')
        current_price = price_data.get('current_price', 0)
        listing_url = price_data.get('listing_url')

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"🚨 {alert_type.replace('_', ' ').title()}"
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Brand:*\n{brand}"},
                    {"type": "mrkdwn", "text": f"*Reference:*\n{reference}"},
                    {"type": "mrkdwn", "text": f"*Current Price:*\n${current_price:,.2f}"},
                ]
            }
        ]

        if listing_url:
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View Listing"},
                        "url": listing_url,
                        "style": "primary"
                    }
                ]
            })

        return blocks

    def _format_opportunity_summary(self, opportunities: List[Dict]) -> str:
        """Format opportunity summary message"""
        count = len(opportunities)
        top_discount = max(opp['discount_percent'] for opp in opportunities)

        message = f"""
🎯 *Daily Opportunity Summary*

Found {count} buying opportunities
Top discount: {top_discount:.1f}%

*Top Opportunities:*
"""

        for i, opp in enumerate(opportunities[:5], 1):
            message += f"\n{i}. {opp['brand']} {opp['reference_number']} - {opp['discount_percent']:.1f}% off"

        return message

    def _create_opportunity_blocks(self, opportunities: List[Dict]) -> List[Dict]:
        """Create Slack blocks for opportunity summary"""
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"🎯 Daily Opportunity Summary ({len(opportunities)} found)"
                }
            }
        ]

        for opp in opportunities[:10]:
            blocks.append({
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*{opp['brand']} {opp['reference_number']}*"},
                    {"type": "mrkdwn", "text": f"*Discount:* {opp['discount_percent']:.1f}%"},
                    {"type": "mrkdwn", "text": f"*Price:* ${opp['current_price_usd']:,.2f}"},
                    {"type": "mrkdwn", "text": f"*Marketplace:* {opp['marketplace']}"},
                ]
            })

            if opp.get('listing_url'):
                blocks.append({
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "View"},
                            "url": opp['listing_url']
                        }
                    ]
                })

            blocks.append({"type": "divider"})

        return blocks


class EmailNotifier:
    """
    Send email notifications via SendGrid
    """

    def __init__(self):
        self.api_key = settings.SENDGRID_API_KEY
        self.from_email = settings.EMAIL_FROM
        self.client = None

        if self.api_key:
            self.client = SendGridAPIClient(self.api_key)

    def send_price_alert(
        self,
        to_emails: List[str],
        watch_info: Dict,
        alert_type: str,
        price_data: Dict
    ) -> bool:
        """
        Send price alert via email

        Args:
            to_emails: List of recipient email addresses
            watch_info: Watch information
            alert_type: Type of alert
            price_data: Price data

        Returns:
            True if successful
        """
        try:
            if not self.client:
                logger.warning("Email client not configured")
                return False

            subject = self._create_subject(watch_info, alert_type)
            html_content = self._create_html_content(watch_info, alert_type, price_data)

            message = Mail(
                from_email=Email(self.from_email),
                to_emails=[To(email) for email in to_emails],
                subject=subject,
                html_content=Content("text/html", html_content)
            )

            response = self.client.send(message)
            logger.info(f"Email sent successfully: {response.status_code}")
            return response.status_code == 202

        except Exception as e:
            logger.error(f"Error sending email: {e}")
            return False

    def send_opportunity_digest(
        self,
        to_emails: List[str],
        opportunities: List[Dict]
    ) -> bool:
        """
        Send daily opportunity digest

        Args:
            to_emails: Recipient emails
            opportunities: List of opportunities

        Returns:
            True if successful
        """
        try:
            if not self.client:
                logger.warning("Email client not configured")
                return False

            subject = f"Daily Opportunity Digest - {len(opportunities)} Opportunities"
            html_content = self._create_digest_html(opportunities)

            message = Mail(
                from_email=Email(self.from_email),
                to_emails=[To(email) for email in to_emails],
                subject=subject,
                html_content=Content("text/html", html_content)
            )

            response = self.client.send(message)
            logger.info(f"Digest email sent successfully")
            return response.status_code == 202

        except Exception as e:
            logger.error(f"Error sending digest email: {e}")
            return False

    def _create_subject(self, watch_info: Dict, alert_type: str) -> str:
        """Create email subject line"""
        brand = watch_info.get('brand', 'Unknown')
        reference = watch_info.get('reference_number', 'Unknown')

        if alert_type == 'price_drop':
            return f"🚨 Price Drop: {brand} {reference}"
        elif alert_type == 'opportunity':
            return f"🎯 Buying Opportunity: {brand} {reference}"
        elif alert_type == 'below_threshold':
            return f"✅ Price Alert: {brand} {reference}"

        return f"Watch Price Alert: {brand} {reference}"

    def _create_html_content(
        self,
        watch_info: Dict,
        alert_type: str,
        price_data: Dict
    ) -> str:
        """Create HTML email content"""
        brand = watch_info.get('brand', 'Unknown')
        reference = watch_info.get('reference_number', 'Unknown')
        current_price = price_data.get('current_price', 0)
        listing_url = price_data.get('listing_url', '#')

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #1f77b4; color: white; padding: 20px; text-align: center; }}
                .content {{ background: #f4f4f4; padding: 20px; margin: 20px 0; }}
                .price {{ font-size: 24px; font-weight: bold; color: #2ecc71; }}
                .button {{ background: #1f77b4; color: white; padding: 10px 20px; text-decoration: none; display: inline-block; margin-top: 10px; }}
                .footer {{ text-align: center; color: #666; padding: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>{alert_type.replace('_', ' ').title()}</h1>
                </div>
                <div class="content">
                    <h2>{brand} {reference}</h2>
                    <p><strong>Current Price:</strong> <span class="price">${current_price:,.2f}</span></p>
        """

        if alert_type == 'price_drop':
            previous_price = price_data.get('previous_price', 0)
            drop_percent = price_data.get('drop_percent', 0)
            html += f"""
                    <p><strong>Previous Price:</strong> ${previous_price:,.2f}</p>
                    <p><strong>Price Drop:</strong> {drop_percent:.1f}%</p>
            """

        elif alert_type == 'opportunity':
            avg_price = price_data.get('average_price', 0)
            discount = price_data.get('discount_percent', 0)
            html += f"""
                    <p><strong>Market Average:</strong> ${avg_price:,.2f}</p>
                    <p><strong>Discount:</strong> {discount:.1f}%</p>
            """

        html += f"""
                    <a href="{listing_url}" class="button">View Listing</a>
                </div>
                <div class="footer">
                    <p>Luxury Watch Pricing Intelligence Engine</p>
                    <p>{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}</p>
                </div>
            </div>
        </body>
        </html>
        """

        return html

    def _create_digest_html(self, opportunities: List[Dict]) -> str:
        """Create HTML for opportunity digest"""
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; }
                .container { max-width: 800px; margin: 0 auto; padding: 20px; }
                .header { background: #1f77b4; color: white; padding: 20px; text-align: center; }
                .opportunity { background: #f9f9f9; margin: 15px 0; padding: 15px; border-left: 4px solid #2ecc71; }
                .discount { font-size: 20px; font-weight: bold; color: #2ecc71; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Daily Opportunity Digest</h1>
                    <p>""" + f"{len(opportunities)} opportunities found" + """</p>
                </div>
        """

        for opp in opportunities:
            html += f"""
                <div class="opportunity">
                    <h3>{opp['brand']} {opp['reference_number']}</h3>
                    <p><strong>Current Price:</strong> ${opp['current_price_usd']:,.2f}</p>
                    <p><strong>Market Average:</strong> ${opp['average_price_usd']:,.2f}</p>
                    <p class="discount">Discount: {opp['discount_percent']:.1f}%</p>
                    <p><strong>Marketplace:</strong> {opp['marketplace']}</p>
                    <a href="{opp['listing_url']}">View Listing →</a>
                </div>
            """

        html += """
            </div>
        </body>
        </html>
        """

        return html


class NotificationManager:
    """
    Unified notification manager
    """

    def __init__(self):
        self.slack = SlackNotifier()
        self.email = EmailNotifier()

    def send_alert(
        self,
        watch_info: Dict,
        alert_type: str,
        price_data: Dict,
        channels: List[str] = ['slack', 'email']
    ) -> Dict[str, bool]:
        """
        Send alert through multiple channels

        Args:
            watch_info: Watch information
            alert_type: Alert type
            price_data: Price data
            channels: List of channels to use

        Returns:
            Dictionary with success status for each channel
        """
        results = {}

        if 'slack' in channels:
            results['slack'] = self.slack.send_price_alert(watch_info, alert_type, price_data)

        if 'email' in channels and settings.EMAIL_TO:
            results['email'] = self.email.send_price_alert(
                settings.EMAIL_TO,
                watch_info,
                alert_type,
                price_data
            )

        return results

    def send_opportunity_summary(
        self,
        opportunities: List[Dict],
        channels: List[str] = ['slack', 'email']
    ) -> Dict[str, bool]:
        """Send opportunity summary through multiple channels"""
        results = {}

        if 'slack' in channels:
            results['slack'] = self.slack.send_opportunity_alert(opportunities)

        if 'email' in channels and settings.EMAIL_TO:
            results['email'] = self.email.send_opportunity_digest(
                settings.EMAIL_TO,
                opportunities
            )

        return results
