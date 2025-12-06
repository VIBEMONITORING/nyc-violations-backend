class Violation::SearchQuery < ApplicationQuery
  def call(params = {})
    @params = params
    filter_by_state
    filter_by_severity
    filter_by_agency
    filter_by_borough
    filter_by_date_range
    apply_ordering
    relation
  end

  private

  attr_reader :params

  def filter_by_state
    return unless params[:state].present?

    @relation = relation.where(state: params[:state])
  end

  def filter_by_severity
    return unless params[:severity].present?

    @relation = relation.where(severity: params[:severity])
  end

  def filter_by_agency
    return unless params[:agency_code].present?

    @relation = relation.joins(:agency).where(agencies: { code: params[:agency_code] })
  end

  def filter_by_borough
    return unless params[:borough].present?

    @relation = relation.joins(:business).where(businesses: { borough: params[:borough] })
  end

  def filter_by_date_range
    if params[:issued_after].present?
      @relation = relation.where("issued_on >= ?", params[:issued_after])
    end

    if params[:issued_before].present?
      @relation = relation.where("issued_on <= ?", params[:issued_before])
    end
  end

  def apply_ordering
    @relation = relation.includes(:business, :agency).order(issued_on: :desc)
  end
end
