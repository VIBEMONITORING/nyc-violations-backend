require "rails_helper"

RSpec.describe "Api::V1::Violations" do
  describe "GET /api/v1/violations" do
    it "returns a list of violations" do
      create_list(:violation, 3)

      get "/api/v1/violations"

      expect(response).to have_http_status(:ok)

      json = JSON.parse(response.body)
      expect(json["data"].length).to eq(3)
      expect(json["meta"]).to include("page", "per_page")
    end

    it "filters by state" do
      active = create(:violation, state: :reported)
      resolved = create(:violation, :resolved)

      get "/api/v1/violations", params: { state: "reported" }

      json = JSON.parse(response.body)
      violation_ids = json["data"].map { |v| v["id"] }

      expect(violation_ids).to include(active.id)
      expect(violation_ids).not_to include(resolved.id)
    end

    it "filters by severity" do
      high = create(:violation, :high_severity)
      low = create(:violation, severity: :low)

      get "/api/v1/violations", params: { severity: "high" }

      json = JSON.parse(response.body)
      violation_ids = json["data"].map { |v| v["id"] }

      expect(violation_ids).to include(high.id)
      expect(violation_ids).not_to include(low.id)
    end
  end

  describe "GET /api/v1/violations/:id" do
    it "returns a single violation with details" do
      violation = create(:violation)

      get "/api/v1/violations/#{violation.id}"

      expect(response).to have_http_status(:ok)

      json = JSON.parse(response.body)
      expect(json["data"]["id"]).to eq(violation.id)
      expect(json["data"]["violation_code"]).to eq(violation.violation_code)
      expect(json["data"]["business"]).to be_present
      expect(json["data"]["agency"]).to be_present
    end

    it "returns 404 for non-existent violation" do
      get "/api/v1/violations/99999"

      expect(response).to have_http_status(:not_found)
    end
  end
end
