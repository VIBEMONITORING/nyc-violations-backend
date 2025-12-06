require "rails_helper"

RSpec.describe "Api::V1::Businesses" do
  describe "GET /api/v1/businesses" do
    it "returns a list of businesses" do
      create_list(:business, 3)

      get "/api/v1/businesses"

      expect(response).to have_http_status(:ok)

      json = JSON.parse(response.body)
      expect(json["data"].length).to eq(3)
    end

    it "filters by borough" do
      manhattan = create(:business, borough: "Manhattan")
      brooklyn = create(:business, borough: "Brooklyn")

      get "/api/v1/businesses", params: { borough: "Manhattan" }

      json = JSON.parse(response.body)
      business_ids = json["data"].map { |b| b["id"] }

      expect(business_ids).to include(manhattan.id)
      expect(business_ids).not_to include(brooklyn.id)
    end
  end

  describe "GET /api/v1/businesses/:id" do
    it "returns a single business with violation details" do
      business = create(:business, :with_violations)

      get "/api/v1/businesses/#{business.id}"

      expect(response).to have_http_status(:ok)

      json = JSON.parse(response.body)
      expect(json["data"]["id"]).to eq(business.id)
      expect(json["data"]["active_violations"]).to be_an(Array)
    end
  end
end
