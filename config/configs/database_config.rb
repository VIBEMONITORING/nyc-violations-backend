class DatabaseConfig < ApplicationConfig
  attr_config :host,
    :port,
    :username,
    :password,
    :database,
    pool: 5

  def connection_url
    return unless configured?

    "postgres://#{username}:#{password}@#{host}:#{port}/#{database}"
  end

  def configured?
    host.present? && database.present?
  end
end
