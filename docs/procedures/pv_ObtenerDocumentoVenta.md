# SP: pv_ObtenerDocumentoVenta
**Tipo**: Punto de Venta
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	pv_ObtenerDocumentoVenta
*DESCRIPCIÓN	:	OBTIENE UN DOCUMENTO DE VENTA SEGUN EL TIPO Y NUMERO QUE LLEGA POR PARAMETRO
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/
CREATE PROCEDURE [dbo].[pv_ObtenerDocumentoVenta]
    (
      @sCo_Tipo_Doc		CHAR(6) ,
      @sNro_Doc			CHAR(20)
    )
AS 
    BEGIN
		SELECT dv.*, CLI.cli_des
			FROM
				saDocumentoVenta DV
				INNER JOIN saCliente CLI ON dv.co_cli = CLI.co_Cli
		WHERE
						dv.nro_doc = @sNro_Doc AND 
						dv.co_tipo_doc = @sCo_Tipo_Doc 
			ORDER BY
				dv.co_tipo_doc, dv.nro_doc

    END
```
