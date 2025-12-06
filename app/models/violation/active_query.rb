class Violation::ActiveQuery < ApplicationQuery
  def call
    relation
      .active
      .includes(:business, :agency)
      .order(severity_score: :desc, issued_on: :desc)
  end
end
