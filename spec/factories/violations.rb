FactoryBot.define do
  factory :violation do
    association :business
    association :agency

    sequence(:violation_code) { |n| "VIO-2024-#{n.to_s.rjust(5, "0")}" }
    description { Faker::Lorem.sentence(word_count: 10) }
    state { "reported" }
    severity { "medium" }
    severity_score { rand(1..10) }
    issued_on { rand(1..30).days.ago.to_date }

    trait :active do
      state { %w[reported pending under_review].sample }
    end

    trait :resolved do
      state { "resolved" }
      resolved_on { 1.day.ago.to_date }
      resolution_notes { "Issue addressed and corrected" }
    end

    trait :high_severity do
      severity { "high" }
      severity_score { rand(7..9) }
    end

    trait :critical do
      severity { "critical" }
      severity_score { 10 }
    end

    trait :with_fine do
      fine_amount { Faker::Commerce.price(range: 100..5000.0) }
    end
  end
end
