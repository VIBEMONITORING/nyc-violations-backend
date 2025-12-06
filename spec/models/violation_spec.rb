require "rails_helper"

RSpec.describe Violation do
  describe "validations" do
    it "validates presence of violation_code" do
      violation = build(:violation, violation_code: nil)
      expect(violation).not_to be_valid
      expect(violation.errors[:violation_code]).to include("can't be blank")
    end

    it "validates uniqueness of violation_code" do
      create(:violation, violation_code: "VIO-001")
      violation = build(:violation, violation_code: "VIO-001")
      expect(violation).not_to be_valid
    end

    it "validates severity_score range" do
      violation = build(:violation, severity_score: 0)
      expect(violation).not_to be_valid

      violation = build(:violation, severity_score: 11)
      expect(violation).not_to be_valid

      violation = build(:violation, severity_score: 5)
      expect(violation).to be_valid
    end

    it "validates resolved_on is after issued_on" do
      violation = build(:violation, issued_on: Date.today, resolved_on: 1.week.ago.to_date)
      expect(violation).not_to be_valid
      expect(violation.errors[:resolved_on]).to include("must be after issued date")
    end
  end

  describe "#active?" do
    it "returns true for reported violations" do
      violation = build(:violation, state: :reported)
      expect(violation.active?).to be true
    end

    it "returns true for pending violations" do
      violation = build(:violation, state: :pending)
      expect(violation.active?).to be true
    end

    it "returns false for resolved violations" do
      violation = build(:violation, state: :resolved)
      expect(violation.active?).to be false
    end
  end

  describe "#can_resolve?" do
    it "returns true for active violations" do
      violation = build(:violation, state: :reported)
      expect(violation.can_resolve?).to be true
    end

    it "returns false for already resolved violations" do
      violation = build(:violation, state: :resolved)
      expect(violation.can_resolve?).to be false
    end
  end

  describe "#resolve!" do
    it "marks violation as resolved with current date" do
      violation = create(:violation, state: :reported)
      violation.resolve!(notes: "Fixed the issue")

      expect(violation.resolved?).to be true
      expect(violation.resolved_on).to eq(Date.current)
      expect(violation.resolution_notes).to eq("Fixed the issue")
    end

    it "returns false if already resolved" do
      violation = create(:violation, :resolved)
      expect(violation.resolve!).to be false
    end
  end

  describe "#days_open" do
    it "calculates days between issued_on and resolved_on" do
      violation = build(:violation, issued_on: 10.days.ago.to_date, resolved_on: 5.days.ago.to_date)
      expect(violation.days_open).to eq(5)
    end

    it "calculates days to current date if not resolved" do
      violation = build(:violation, issued_on: 10.days.ago.to_date, resolved_on: nil)
      expect(violation.days_open).to eq(10)
    end
  end

  describe "scopes" do
    describe ".active" do
      it "returns only active violations" do
        active = create(:violation, :active)
        resolved = create(:violation, :resolved)

        expect(Violation.active).to include(active)
        expect(Violation.active).not_to include(resolved)
      end
    end

    describe ".high_priority" do
      it "returns high and critical severity violations" do
        high = create(:violation, :high_severity)
        critical = create(:violation, :critical)
        low = create(:violation, severity: :low)

        result = Violation.high_priority
        expect(result).to include(high, critical)
        expect(result).not_to include(low)
      end
    end
  end
end
