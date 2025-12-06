class Agency < ApplicationRecord
  # 1. Gems and DSL extensions
  extend FriendlyId
  friendly_id :code, use: [:slugged, :finders]

  # 2. Associations
  has_many :violations, dependent: :restrict_with_error

  # 3. Normalization
  normalizes :code, with: ->(code) { code.strip.upcase }
  normalizes :name, with: ->(name) { name.strip }

  # 4. Validations
  validates :name, :code, :slug, presence: true
  validates :code, uniqueness: true

  # 5. Scopes
  scope :alphabetical, -> { order(name: :asc) }

  # 6. Public instance methods
  def violations_count
    violations.count
  end
end
