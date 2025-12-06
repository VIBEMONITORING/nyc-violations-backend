class CreateViolationStatesEnum < ActiveRecord::Migration[7.1]
  def up
    execute <<-SQL
      CREATE TYPE violation_state AS ENUM ('reported', 'pending', 'under_review', 'resolved', 'dismissed');
    SQL

    execute <<-SQL
      CREATE TYPE severity_level AS ENUM ('low', 'medium', 'high', 'critical');
    SQL
  end

  def down
    execute <<-SQL
      DROP TYPE violation_state;
    SQL

    execute <<-SQL
      DROP TYPE severity_level;
    SQL
  end
end
