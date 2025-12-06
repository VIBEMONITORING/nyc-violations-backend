source "https://rubygems.org"

ruby "3.3.0"

# Core Rails & Server
gem "rails", "~> 7.1"
gem "puma", "~> 6.0"
gem "propshaft"

# Database
gem "pg", "~> 1.5"

# Frontend
gem "hotwire-rails"
gem "view_component"
gem "vite_rails"

# Jobs
gem "solid_queue"

# Configuration
gem "anyway_config", "~> 2.6"

# IDs & Slugs
gem "nanoid"
gem "friendly_id", "~> 5.5"

# HTTP
gem "httparty"

# Error Tracking (optional)
gem "sentry-rails"

# Reduces boot times through caching
gem "bootsnap", require: false

group :development, :test do
  gem "rspec-rails", "~> 6.1"
  gem "factory_bot_rails"
  gem "faker"
  gem "debug"
  gem "standard"
end

group :development do
  gem "web-console"
end

group :test do
  gem "test_prof"
  gem "capybara"
  gem "selenium-webdriver"
end
