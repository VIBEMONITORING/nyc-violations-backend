class AppConfig < ApplicationConfig
  attr_config :host,
    :port,
    api_version: "v1",
    max_page_size: 100,
    default_page_size: 25

  def ssl?
    port == 443
  end

  def base_url
    proto = ssl? ? "https://" : "http://"
    port_suffix = [80, 443].include?(port.to_i) ? "" : ":#{port}"
    "#{proto}#{host}#{port_suffix}"
  end

  def api_base_url
    "#{base_url}/api/#{api_version}"
  end
end
