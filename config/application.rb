require_relative "boot"

require "rails/all"

Bundler.require(*Rails.groups)

module NycViolationsBackend
  class Application < Rails::Application
    config.load_defaults 7.1

    # API-only mode for backend service
    config.api_only = true

    # Use RSpec for testing
    config.generators do |g|
      g.test_framework :rspec
      g.fixture_replacement :factory_bot, dir: "spec/factories"
    end

    # Autoload lib directory
    config.autoload_lib(ignore: %w[assets tasks])

    # Time zone
    config.time_zone = "Eastern Time (US & Canada)"
  end
end
