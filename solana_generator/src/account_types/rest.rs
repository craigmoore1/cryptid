use crate::{AccountArgument, AccountInfo, GeneratorResult, Pubkey, SystemProgram};
use std::iter::once;

/// An account argument that takes the rest of the accounts as type `T`
#[derive(Debug)]
pub struct Rest<T>(pub Vec<T>);
impl<T> AccountArgument for Rest<T>
where
    T: AccountArgument,
    T::InstructionArg: Clone,
{
    type InstructionArg = T::InstructionArg;

    fn from_account_infos(
        program_id: Pubkey,
        infos: &mut impl Iterator<Item = AccountInfo>,
        data: &mut &[u8],
        arg: Self::InstructionArg,
    ) -> GeneratorResult<Self> {
        let mut out = Vec::new();
        let mut infos = Box::new(infos) as Box<dyn Iterator<Item = AccountInfo>>;
        while let Some(info) = infos.next() {
            infos = Box::new(once(info).chain(infos));
            out.push(T::from_account_infos(
                program_id,
                &mut infos,
                data,
                arg.clone(),
            )?);
        }
        Ok(Self(out))
    }

    fn write_back(
        self,
        program_id: Pubkey,
        system_program: Option<&SystemProgram>,
    ) -> GeneratorResult<()> {
        self.0.write_back(program_id, system_program)
    }

    fn add_keys(&self, add: impl FnMut(Pubkey) -> GeneratorResult<()>) -> GeneratorResult<()> {
        self.0.add_keys(add)
    }
}
