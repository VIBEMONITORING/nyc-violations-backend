Rails.application.routes.draw do
  # Health check endpoint
  get "health", to: "health#show"

  # API namespace for violations
  namespace :api do
    namespace :v1 do
      resources :violations, only: [:index, :show]
      resources :businesses, only: [:index, :show] do
        resources :violations, only: [:index], controller: "business_violations"
      end
    end
  end

  # Root route
  root "health#show"
end
