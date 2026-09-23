pub mod consts;
pub mod error;
pub mod instruction;
pub mod state;

pub mod prelude {
    pub use crate::consts::*;
    pub use crate::error::*;
    pub use crate::instruction::*;
    pub use crate::state::*;
}

use steel::*;

// Program ID for Arkana ORE Vault
declare_id!("HZrfoHKA76URt1jfa2bn9Tmunjb8gBehGUW4rgmSASnH");
