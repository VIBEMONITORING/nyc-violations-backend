class Business < ApplicationRecord
  # 1. Gems and DSL extensions
  extend FriendlyId
  friendly_id :name, use: [:slugged, :finders]

  # 2. Associations
  has_many :violations, dependent: :destroy

  # 3. Normalization
  normalizes :name, with: ->(name) { name.strip }
  normalizes :zip_code, with: ->(zip) { zip&.strip }
  normalizes :phone, with: ->(phone) { phone&.gsub(/\D/, "") }

  # 4. Validations
  validates :name, :slug, presence: true
  validates :zip_code, format: { with: /\A\d{5}(-\d{4})?\z/, allow_blank: true }

  # 5. Scopes
  scope :alphabetical, -> { order(name: :asc) }
  scope :in_borough, ->(borough) { where(borough: borough) }
  scope :with_violations, -> { where("violations_count > 0") }
  scope :recent, -> { order(created_at: :desc) }

  # 6. Public instance methods
  def full_address
    [address, borough, zip_code].compact.join(", ")
  end

  def active_violations
    violations.active
  end

  def resolved_violations
    violations.resolved
  end
end
