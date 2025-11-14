"""
NYC Violation Compliance System - Hearing Response Document Generator

Automatically generates hearing responses and evidence packets.
"""

from jinja2 import Environment, FileSystemLoader, Template
from datetime import datetime
from typing import Dict, List, Optional
import logging


logger = logging.getLogger(__name__)


class HearingResponseGenerator:
    """
    Automatically generate hearing response documents and evidence packets
    """

    # Defense strategies by violation code
    DEFENSE_STRATEGIES = {
        '04L': {  # Facility not vermin proof
            'defense': 'Corrective Action Taken',
            'evidence_needed': [
                'Pest control service contract',
                'Recent inspection report',
                'Photos of corrected conditions'
            ],
            'template': 'Upon notification, respondent immediately retained licensed pest control operator. All identified entry points sealed on {date}. Ongoing monitoring program established.'
        },
        '06D': {  # Food contact surface not maintained
            'defense': 'Equipment Replacement + Training',
            'evidence_needed': [
                'Equipment purchase receipts',
                'Staff training records',
                'Cleaning schedule documentation'
            ],
            'template': 'Equipment replaced {date}. All staff retrained on proper sanitation procedures. Enhanced monitoring protocols implemented.'
        },
        '10B': {  # Toilet facility not maintained
            'defense': 'Immediate Remediation',
            'evidence_needed': [
                'Plumber invoice',
                'Photos of repairs',
                'Maintenance schedule'
            ],
            'template': 'Plumbing repairs completed {date}. Daily inspection checklist implemented. Staff trained on maintenance protocols.'
        },
        '02A': {  # Food not properly protected
            'defense': 'Training and Procedure Enhancement',
            'evidence_needed': [
                'Updated food handling procedures',
                'Staff training certificates',
                'Temperature log records'
            ],
            'template': 'All food handlers received additional training on proper food protection. New procedures implemented and monitored daily. Corrective actions taken {date}.'
        },
        '08A': {  # Facility not vermin proof
            'defense': 'Structural Repairs Completed',
            'evidence_needed': [
                'Contractor invoices',
                'Before/after photos',
                'Follow-up inspection'
            ],
            'template': 'Structural deficiencies repaired by licensed contractor. All gaps and openings sealed. Preventive maintenance schedule established.'
        }
    }

    def __init__(self, template_dir: str = 'templates'):
        """
        Initialize generator

        Args:
            template_dir: Directory containing Jinja2 templates
        """
        try:
            self.env = Environment(loader=FileSystemLoader(template_dir))
        except Exception:
            # Fallback to string templates if directory doesn't exist
            self.env = Environment()
            logger.warning(f"Template directory {template_dir} not found, using inline templates")

    def generate_response_brief(self, hearing_data: Dict) -> str:
        """
        Generate formal hearing response document

        Args:
            hearing_data: Dictionary containing:
                - establishment: Establishment object
                - hearing_date: Date of hearing
                - violations: List of Violation objects
                - corrective_actions: List of actions taken
                - mitigation_factors: List of mitigating circumstances

        Returns:
            HTML formatted hearing response
        """

        # Analyze violations and prepare defenses
        defenses = self._prepare_defenses(hearing_data.get('violations', []))

        # Generate mitigation narrative
        mitigation = self._generate_mitigation_narrative(hearing_data)

        # Prepare context for template
        context = {
            'respondent': hearing_data.get('establishment'),
            'hearing_date': hearing_data.get('hearing_date', datetime.now()),
            'violations': hearing_data.get('violations', []),
            'defenses': defenses,
            'mitigation': mitigation,
            'generated_date': datetime.now().strftime('%B %d, %Y'),
            'corrective_actions': hearing_data.get('corrective_actions', [])
        }

        # Generate HTML document
        template = self._get_hearing_response_template()
        html_output = template.render(context)

        return html_output

    def _prepare_defenses(self, violations: List) -> List[Dict]:
        """
        Map violations to legal defenses

        Args:
            violations: List of Violation objects

        Returns:
            List of defense strategies
        """

        defenses = []

        for violation in violations:
            code = violation.violation_code if hasattr(violation, 'violation_code') else str(violation)

            if code in self.DEFENSE_STRATEGIES:
                strategy = self.DEFENSE_STRATEGIES[code].copy()
                strategy['violation_code'] = code
                strategy['violation_description'] = (
                    violation.description if hasattr(violation, 'description')
                    else 'Violation description not available'
                )
                defenses.append(strategy)
            else:
                # Generic defense for unmapped violations
                defenses.append({
                    'violation_code': code,
                    'violation_description': (
                        violation.description if hasattr(violation, 'description')
                        else 'Violation description'
                    ),
                    'defense': 'Immediate Corrective Action',
                    'evidence_needed': ['Documentation of corrective measures'],
                    'template': 'Upon notification of this violation, immediate corrective action was taken. All necessary measures have been implemented to prevent recurrence.'
                })

        return defenses

    def _generate_mitigation_narrative(self, hearing_data: Dict) -> Dict[str, str]:
        """
        Create compelling mitigation story

        Args:
            hearing_data: Hearing data dictionary

        Returns:
            Dictionary with narrative components
        """

        establishment = hearing_data.get('establishment')
        violations = hearing_data.get('violations', [])

        # Build narrative
        intro = f"""
        {establishment.dba if establishment else 'The establishment'} is committed to maintaining the highest standards
        of food safety and regulatory compliance. The violations cited were addressed immediately upon discovery.
        """

        # List corrective actions
        actions = hearing_data.get('corrective_actions', [])
        actions_text = "\n".join([f"- {action}" for action in actions]) if actions else "- Immediate remediation completed"

        conclusion = """
        Given the establishment's demonstrated commitment to compliance, immediate corrective action,
        and implementation of enhanced monitoring procedures, we respectfully request that the tribunal
        consider these mitigating factors in its determination.
        """

        return {
            'introduction': intro.strip(),
            'corrective_actions': actions_text,
            'conclusion': conclusion.strip()
        }

    def _get_hearing_response_template(self) -> Template:
        """
        Get or create hearing response template

        Returns:
            Jinja2 Template object
        """

        template_str = """
<!DOCTYPE html>
<html>
<head>
    <title>Hearing Response - {{ respondent.dba if respondent else 'Establishment' }}</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            margin: 1in;
            line-height: 1.6;
        }
        h1 {
            text-align: center;
            font-size: 18pt;
            margin-bottom: 30px;
        }
        h2 {
            font-size: 14pt;
            margin-top: 25px;
            margin-bottom: 15px;
        }
        .header-info {
            margin-bottom: 30px;
        }
        .header-info p {
            margin: 5px 0;
        }
        .violation {
            margin: 20px 0;
            padding: 15px;
            border-left: 3px solid #333;
            background-color: #f9f9f9;
        }
        .defense {
            margin-left: 20px;
            margin-top: 10px;
        }
        .signature {
            margin-top: 50px;
        }
    </style>
</head>
<body>
    <h1>RESPONSE TO NOTICE OF VIOLATION</h1>

    <div class="header-info">
        <p><strong>Respondent:</strong> {{ respondent.dba if respondent else 'N/A' }}</p>
        {% if respondent %}
        <p><strong>Address:</strong> {{ respondent.full_address }}</p>
        <p><strong>CAMIS:</strong> {{ respondent.camis }}</p>
        {% endif %}
        <p><strong>Hearing Date:</strong> {{ hearing_date.strftime('%B %d, %Y') if hearing_date else 'N/A' }}</p>
    </div>

    <h2>STATEMENT OF FACTS</h2>
    <p>{{ mitigation.introduction }}</p>

    <h2>VIOLATIONS AND DEFENSES</h2>
    {% for violation in violations %}
    <div class="violation">
        <p><strong>Violation {{ loop.index }}:</strong>
           {% if violation.violation_code %}{{ violation.violation_code }} -{% endif %}
           {{ violation.description if violation.description else 'Violation description' }}
        </p>

        {% for defense in defenses %}
        {% if defense.violation_code == (violation.violation_code if violation.violation_code else '') %}
        <div class="defense">
            <p><strong>Defense:</strong> {{ defense.defense }}</p>
            <p>{{ defense.template }}</p>
            <p><strong>Supporting Evidence:</strong></p>
            <ul>
            {% for item in defense.evidence_needed %}
                <li>{{ item }} (See Exhibit {{ loop.index }})</li>
            {% endfor %}
            </ul>
        </div>
        {% endif %}
        {% endfor %}
    </div>
    {% endfor %}

    <h2>CORRECTIVE ACTIONS</h2>
    <p>The following corrective actions have been implemented:</p>
    <pre>{{ mitigation.corrective_actions }}</pre>

    <h2>CONCLUSION</h2>
    <p>{{ mitigation.conclusion }}</p>

    <div class="signature">
        <p>Respectfully submitted,</p>
        <br><br>
        <p>_______________________</p>
        <p>Compliance Representative</p>
        <p>{{ generated_date }}</p>
    </div>

    <h2>EXHIBITS</h2>
    <p>[Evidence packet attached separately]</p>
</body>
</html>
"""

        return self.env.from_string(template_str)

    def generate_violation_summary(self, violations: List) -> str:
        """
        Generate a summary report of all violations

        Args:
            violations: List of Violation objects

        Returns:
            HTML formatted summary
        """

        from collections import Counter

        # Analyze violations
        violation_codes = [v.violation_code for v in violations if hasattr(v, 'violation_code')]
        code_counts = Counter(violation_codes)

        critical_count = sum(1 for v in violations if hasattr(v, 'critical_flag') and v.critical_flag)

        summary_html = f"""
        <h2>Violation Summary</h2>
        <p><strong>Total Violations:</strong> {len(violations)}</p>
        <p><strong>Critical Violations:</strong> {critical_count}</p>
        <p><strong>Unique Violation Types:</strong> {len(code_counts)}</p>

        <h3>Most Common Violations:</h3>
        <ul>
        """

        for code, count in code_counts.most_common(5):
            summary_html += f"<li>{code}: {count} occurrences</li>\n"

        summary_html += "</ul>"

        return summary_html

    def generate_compliance_action_plan(self, establishment, violations: List) -> str:
        """
        Generate a compliance action plan

        Args:
            establishment: Establishment object
            violations: List of violations

        Returns:
            HTML formatted action plan
        """

        plan_html = f"""
        <h1>Compliance Action Plan</h1>
        <p><strong>Establishment:</strong> {establishment.dba if establishment else 'N/A'}</p>
        <p><strong>Date:</strong> {datetime.now().strftime('%B %d, %Y')}</p>

        <h2>Identified Issues</h2>
        <ol>
        """

        for i, violation in enumerate(violations[:10], 1):  # Limit to 10
            plan_html += f"<li>{violation.description if hasattr(violation, 'description') else 'Violation'}</li>\n"

        plan_html += """
        </ol>

        <h2>Action Steps</h2>
        <ol>
            <li>Immediate corrective action for all critical violations</li>
            <li>Staff training on compliance procedures</li>
            <li>Implementation of monitoring systems</li>
            <li>Regular self-inspections</li>
            <li>Documentation of all corrective measures</li>
        </ol>

        <h2>Timeline</h2>
        <p><strong>Immediate (0-7 days):</strong> Address critical violations</p>
        <p><strong>Short-term (7-30 days):</strong> Implement training and procedures</p>
        <p><strong>Long-term (30+ days):</strong> Ongoing monitoring and improvement</p>
        """

        return plan_html
