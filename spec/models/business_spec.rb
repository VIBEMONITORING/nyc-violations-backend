require "rails_helper"

RSpec.describe Business do
  describe "validations" do
    it "validates presence of name" do
      business = build(:business, name: nil)
      expect(business).not_to be_valid
    end

    it "validates zip_code format" do
      business = build(:business, zip_code: "invalid")
      expect(business).not_to be_valid

      business = build(:business, zip_code: "10001")
      expect(business).to be_valid

      business = build(:business, zip_code: "10001-1234")
      expect(business).to be_valid
    end
  end

  describe "#full_address" do
    it "combines address, borough, and zip_code" do
      business = build(:business, address: "123 Main St", borough: "Manhattan", zip_code: "10001")
      expect(business.full_address).to eq("123 Main St, Manhattan, 10001")
    end

    it "handles missing components" do
      business = build(:business, address: "123 Main St", borough: nil, zip_code: "10001")
      expect(business.full_address).to eq("123 Main St, 10001")
    end
  end

  describe "scopes" do
    describe ".in_borough" do
      it "filters by borough" do
        manhattan = create(:business, borough: "Manhattan")
        brooklyn = create(:business, borough: "Brooklyn")

        expect(Business.in_borough("Manhattan")).to include(manhattan)
        expect(Business.in_borough("Manhattan")).not_to include(brooklyn)
      end
    end

    describe ".with_violations" do
      it "returns businesses with violations_count > 0" do
        with_violations = create(:business, :with_violations)
        without = create(:business)

        expect(Business.with_violations).to include(with_violations)
        expect(Business.with_violations).not_to include(without)
      end
    end
  end
end
