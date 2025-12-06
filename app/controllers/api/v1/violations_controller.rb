module Api
  module V1
    class ViolationsController < ApplicationController
      def index
        violations = Violation::SearchQuery.call(search_params)
        violations = paginate(violations)

        render json: {
          data: violations.map { |v| serialize_violation(v) },
          meta: pagination_meta(violations)
        }
      end

      def show
        violation = Violation.includes(:business, :agency).find(params[:id])

        render json: { data: serialize_violation(violation) }
      end

      private

      def search_params
        params.permit(:state, :severity, :agency_code, :borough, :issued_after, :issued_before)
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
          days_open: violation.days_open,
          fine_amount: violation.fine_amount,
          business: {
            id: violation.business.id,
            name: violation.business.name,
            slug: violation.business.slug,
            address: violation.business.full_address
          },
          agency: {
            id: violation.agency.id,
            code: violation.agency.code,
            name: violation.agency.name
          }
        }
      end
    end
  end
end
