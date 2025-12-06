class HealthController < ApplicationController
  def show
    render json: {
      status: "healthy",
      timestamp: Time.current,
      message: "NYC Violations API is running!"
    }
  end
end
