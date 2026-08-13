# SP: pSeleccionarSerialesSalida
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSeriales`](../tables/saSeriales.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pSeleccionarSerialesEntrada]
DESCRIPCION:	Seleccionar Seriales de entrada
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarSerialesSalida]
    (
      @gNum_Doc UNIQUEIDENTIFIER ,
      @sTipo_Doc CHAR(4)
		--@sRowGuid	uniqueidentifier = NULL
	
    )
AS 
    BEGIN
        SELECT
            *
        FROM
            saSeriales 
--	WHERE 
--		((@sCo_Art IS NULL) OR (co_art = @sCo_Art)) AND 
--		((@sCo_Alma IS NULL) OR (co_alma = @sCo_Alma)) AND 
--		(doc_num_s = @gNum_Doc)
        WHERE
            ( doc_tip_s = @sTipo_Doc
              AND doc_num_s = @gNum_Doc
            ) --RowGuid = @sRowGuid
        ORDER BY
            LEN(serial), serial
    END
```
