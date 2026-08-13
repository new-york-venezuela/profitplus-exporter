# SP: pObtenerNacProveedor
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:		pObtenerNacProveedor
*AUTOR			:		SOFTECH SISTEMAS.
*DESCRIPCIÓN	:		
************************************************************************************************/

CREATE PROCEDURE [dbo].[pObtenerNacProveedor]
    (
      @sDoc_num CHAR(20) ,
      @sCo_tipoDoc CHAR(6)
    )
AS 
    BEGIN
        DECLARE @boNac BIT        

		IF @sCo_tipoDoc = 'COMP'
			BEGIN
				SET @boNac = (SELECT  
					PR.nacional
				FROM 
					saFacturaCompra FC
					INNER JOIN saProveedor PR ON FC.co_prov = PR.co_prov
				WHERE
					FC.doc_num = @sDoc_num)
			END
		ELSE
			BEGIN
				SET @boNac = (SELECT  
					PR.nacional
				FROM 
					saPlantillaCompra PC
					INNER JOIN saProveedor PR ON PC.co_prov = PR.co_prov
				WHERE
					PC.doc_num = @sDoc_num)
			END

			Select @boNac as Nac

    END
```
