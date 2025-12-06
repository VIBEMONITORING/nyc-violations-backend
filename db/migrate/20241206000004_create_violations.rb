class CreateViolations < ActiveRecord::Migration[7.1]
  def change
    create_table :violations do |t|
      t.references :business, null: false, foreign_key: { on_delete: :cascade }
      t.references :agency, null: false, foreign_key: { on_delete: :restrict }

      t.string :violation_code, null: false
      t.text :description, null: false
      t.column :state, :violation_state, default: "reported", null: false
      t.column :severity, :severity_level, default: "medium", null: false
      t.integer :severity_score, default: 5, null: false
      t.date :issued_on, null: false
      t.date :resolved_on
      t.decimal :fine_amount, precision: 10, scale: 2
      t.text :resolution_notes

      t.timestamps
    end

    add_index :violations, :violation_code
    add_index :violations, :state
    add_index :violations, :severity
    add_index :violations, :issued_on
    add_index :violations, [:business_id, :state]

    add_check_constraint :violations, "severity_score >= 1 AND severity_score <= 10", name: "severity_score_range"
  end
end
