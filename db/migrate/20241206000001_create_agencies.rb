class CreateAgencies < ActiveRecord::Migration[7.1]
  def change
    create_table :agencies do |t|
      t.string :name, null: false
      t.string :code, null: false
      t.text :description
      t.string :slug, null: false

      t.timestamps
    end

    add_index :agencies, :code, unique: true
    add_index :agencies, :slug, unique: true
  end
end
