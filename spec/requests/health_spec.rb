require "rails_helper"

RSpec.describe "Health Check" do
  describe "GET /health" do
    it "returns healthy status" do
      get "/health"

      expect(response).to have_http_status(:ok)

      json = JSON.parse(response.body)
      expect(json["status"]).to eq("healthy")
      expect(json["message"]).to eq("NYC Violations API is running!")
      expect(json["timestamp"]).to be_present
    end
  end
end
