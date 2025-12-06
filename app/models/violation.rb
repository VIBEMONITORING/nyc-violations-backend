class Violation < ApplicationRecord
  # 1. Associations
  belongs_to :business, counter_cache: true
  belongs_to :agency

  # 2. Enums (for state)
  enum :state, %w[reported pending under_review resolved dismissed].index_by(&:itself)
  enum :severity, %w[low medium high critical].index_by(&:itself)

  # 3. Validations
  validates :violation_code, :description, :issued_on, presence: true
  validates :violation_code, uniqueness: true
  validates :severity_score, numericality: { in: 1..10 }
  validate :resolved_on_after_issued_on

  # 4. Scopes
  scope :active, -> { where(state: %w[reported pending under_review]) }
  scope :resolved, -> { where(state: "resolved") }
  scope :by_severity, ->(level) { where(severity: level) }
  scope :recent, -> { order(issued_on: :desc) }
  scope :high_priority, -> { where(severity: %w[high critical]).recent }
  scope :for_agency, ->(agency) { where(agency: agency) }
  scope :issued_between, ->(start_date, end_date) { where(issued_on: start_date..end_date) }

  # 5. Callbacks
  before_validation do
    self.state ||= :reported
    self.severity ||= :medium
  end

  # 6. Delegated methods
  delegate :name, to: :business, prefix: true
  delegate :name, :code, to: :agency, prefix: true

  # 7. Public instance methods
  def active?
    reported? || pending? || under_review?
  end

  def can_resolve?
    active? && !resolved?
  end

  def resolve!(notes: nil)
    return false unless can_resolve?

    update!(
      state: :resolved,
      resolved_on: Time.current.to_date,
      resolution_notes: notes
    )
  end

  def days_open
    return 0 unless issued_on

    end_date = resolved_on || Time.current.to_date
    (end_date - issued_on).to_i
  end

  private

  def resolved_on_after_issued_on
    return unless resolved_on && issued_on

    if resolved_on < issued_on
      errors.add(:resolved_on, "must be after issued date")
    end
  end
end
