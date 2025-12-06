module Api
  module V1
    class BusinessViolationsController < ApplicationController
      before_action :set_business

      def index
        violations = @business.violations.includes(:agency)
        violations = filter_violations(violations)
        violations = paginate(violations.recent)

        render json: {
          data: violations.map { |v| serialize_violation(v) },
          meta: pagination_meta(violations)
        }
      end

      private

      def set_business
        @business = Business.find(params[:business_id])
      end

      def filter_violations(relation)
        relation = relation.where(state: params[:state]) if params[:state].present?
        relation = relation.where(severity: params[:severity]) if params[:severity].present?
        relation
      end

      def paginate(relation)
        page = pagination_params[:page]
        per_page = pagination_params[:per_page]

        relation.offset((page - 1) * per_page).limit(per_page)
      end

      def pagination_meta(relation)
        {
          page: pagination_params[:page],
          per_page: pagination_params[:per_page]
        }
      end

      def serialize_violation(violation)
        {
          id: violation.id,
          violation_code: violation.violation_code,
          description: violation.description,
          state: violation.state,
          severity: violation.severity,
          severity_score: violation.severity_score,
          issued_on: violation.issued_on,
          resolved_on: violation.resolved_on,
          agency: {
            code: violation.agency.code,
            name: violation.agency.name
          }
        }
      end
    end
  end
end
