# SP: pSeleccionarImpuestoMunicipal
**Tipo**: Seleccionar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpMun`](../tables/saImpMun.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarImpuestoMunicipal
DESCRIPCION: Seleccionar Impuesto  Municipal
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarImpuestoMunicipal]
    (
      @sCo_Imun CHAR(15) ,
      @sCo_Sucur CHAR(6)
    )
AS 
    BEGIN

        SELECT
            *
        FROM
            saImpMun
        WHERE
            co_imun = @sCo_Imun
            AND co_sucur = @sCo_Sucur
	
    END
```
