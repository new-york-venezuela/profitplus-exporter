# SP: pValidarFechaUltimoInv
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saInventarioFisico`](../tables/saInventarioFisico.md)

## Código (excerpt)
```sql
/*************************************************************************************************
*NOMBRE			: [pValidarFechaUltimoInv]
*DESCRIPCIÓN	: verifica si una fecha es mayor a la fecha de ultimo cierre de inventario
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2010-05-25
*************************************************************************************************/

CREATE PROCEDURE [pValidarFechaUltimoInv]
    (
      @sCo_Alma CHAR(6) ,
      @sCo_InvFisico CHAR(20) ,
      @sdFecha SMALLDATETIME
    )
AS 
    BEGIN	

if(@sCo_Alma is not null AND @sCo_Alma <> '')
begin
       SELECT TOP 1
            co_invfisico
        FROM
            saInventarioFisico
        WHERE
            inicio > @sdFecha
            AND (co_alma = @sCo_Alma or co_alma is null)
            AND (co_invfisico <> @sCo_InvFisico)
            AND cierre is not null
 end 
  ELSE    
 begin
   SELECT TOP 1
            co_invfisico
        FROM
            saInventarioFisico
        WHERE
            inicio > @sdFecha
            AND cierre is not null
 
 end

    END
```
