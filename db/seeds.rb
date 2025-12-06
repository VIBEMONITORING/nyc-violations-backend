# Seeds for NYC Violations API

# Create agencies
agencies_data = [
  { code: "DOH", name: "Department of Health", description: "Health and safety violations" },
  { code: "DCWP", name: "Department of Consumer and Worker Protection", description: "Consumer protection violations" },
  { code: "DOB", name: "Department of Buildings", description: "Building code violations" },
  { code: "FDNY", name: "Fire Department", description: "Fire safety violations" },
  { code: "DEP", name: "Department of Environmental Protection", description: "Environmental violations" }
]

agencies = agencies_data.map do |data|
  Agency.find_or_create_by!(code: data[:code]) do |agency|
    agency.name = data[:name]
    agency.description = data[:description]
  end
end

puts "Created #{Agency.count} agencies"

# Create sample businesses
businesses_data = [
  { name: "Corner Deli", address: "123 Main St", borough: "Manhattan", zip_code: "10001" },
  { name: "Brooklyn Bistro", address: "456 Atlantic Ave", borough: "Brooklyn", zip_code: "11217" },
  { name: "Queens Cafe", address: "789 Queens Blvd", borough: "Queens", zip_code: "11375" },
  { name: "Bronx Bakery", address: "321 Grand Concourse", borough: "Bronx", zip_code: "10451" },
  { name: "Staten Island Seafood", address: "555 Victory Blvd", borough: "Staten Island", zip_code: "10301" }
]

businesses = businesses_data.map do |data|
  Business.find_or_create_by!(name: data[:name]) do |business|
    business.address = data[:address]
    business.borough = data[:borough]
    business.zip_code = data[:zip_code]
  end
end

puts "Created #{Business.count} businesses"

# Create sample violations
doh = Agency.find_by!(code: "DOH")
dcwp = Agency.find_by!(code: "DCWP")

violations_data = [
  {
    business: businesses[0],
    agency: doh,
    violation_code: "DOH-2024-001",
    description: "Food not stored at proper temperature",
    severity: "high",
    severity_score: 8,
    issued_on: 1.week.ago.to_date
  },
  {
    business: businesses[1],
    agency: dcwp,
    violation_code: "DCWP-2024-042",
    description: "Missing price display on menu items",
    severity: "low",
    severity_score: 3,
    issued_on: 2.weeks.ago.to_date,
    state: "resolved",
    resolved_on: 1.week.ago.to_date
  },
  {
    business: businesses[0],
    agency: doh,
    violation_code: "DOH-2024-015",
    description: "Improper hand washing facilities",
    severity: "medium",
    severity_score: 6,
    issued_on: 3.days.ago.to_date
  }
]

violations_data.each do |data|
  Violation.find_or_create_by!(violation_code: data[:violation_code]) do |violation|
    violation.business = data[:business]
    violation.agency = data[:agency]
    violation.description = data[:description]
    violation.severity = data[:severity]
    violation.severity_score = data[:severity_score]
    violation.issued_on = data[:issued_on]
    violation.state = data[:state] || "reported"
    violation.resolved_on = data[:resolved_on]
  end
end

puts "Created #{Violation.count} violations"
puts "Seeding complete!"
