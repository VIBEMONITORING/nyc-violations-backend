FactoryBot.define do
  factory :agency do
    sequence(:name) { |n| "Agency #{n}" }
    sequence(:code) { |n| "AG#{n}" }

    trait :doh do
      name { "Department of Health" }
      code { "DOH" }
      description { "Health and safety violations" }
    end

    trait :dcwp do
      name { "Department of Consumer and Worker Protection" }
      code { "DCWP" }
      description { "Consumer protection violations" }
    end
  end
end
