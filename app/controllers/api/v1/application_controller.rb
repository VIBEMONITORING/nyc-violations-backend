module Api
  module V1
    class ApplicationController < ::ApplicationController
      before_action :set_default_format

      private

      def set_default_format
        request.format = :json
      end

      def pagination_params
        {
          page: params.fetch(:page, 1).to_i,
          per_page: [params.fetch(:per_page, 25).to_i, 100].min
        }
      end
    end
  end
end
