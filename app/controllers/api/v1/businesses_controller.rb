module Api
  module V1
    class BusinessesController < ApplicationController
      def index
        businesses = Business.includes(:violations)
        businesses = filter_businesses(businesses)
        businesses = paginate(businesses.alphabetical)

        render json: {
          data: businesses.map { |b| serialize_business(b) },
          meta: pagination_meta(businesses)
        }
      end

      def show
        business = Business.find(params[:id])

        render json: { data: serialize_business(business, include_violations: true) }
      end

      private

      def filter_businesses(relation)
        relation = relation.in_borough(params[:borough]) if params[:borough].present?
        relation = relation.with_violations if params[:has_violations].present?
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

      def serialize_business(business, include_violations: false)
        data = {
          id: business.id,
          name: business.name,
          slug: business.slug,
          address: business.full_address,
          borough: business.borough,
          violations_count: business.violations_count
        }

        if include_violations
          data[:active_violations] = business.active_violations.recent.limit(10).map do |v|
            {
              id: v.id,
              violation_code: v.violation_code,
              description: v.description,
              severity: v.severity,
              issued_on: v.issued_on
            }
          end
        end

        data
      end
    end
  end
end
