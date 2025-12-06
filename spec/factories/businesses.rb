FactoryBot.define do
  factory :business do
    sequence(:name) { |n| "#{Faker::Restaurant.name} #{n}" }
    address { Faker::Address.street_address }
    borough { %w[Manhattan Brooklyn Queens Bronx Staten\ Island].sample }
    zip_code { Faker::Address.zip_code[0..4] }
    phone { Faker::PhoneNumber.phone_number }

    trait :with_violations do
      after(:create) do |business|
        create_list(:violation, 3, business: business)
      end
    end
  end
end
