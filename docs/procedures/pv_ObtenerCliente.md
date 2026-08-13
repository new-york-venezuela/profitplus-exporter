# SP: pv_ObtenerCliente
**Tipo**: Punto de Venta
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saTipoCliente`](../tables/saTipoCliente.md)
- [`saTipoPrecio`](../tables/saTipoPrecio.md)

## Código (excerpt)
```sql
/**************************************************************************
		*NOMBRE			: [pv_ObtenerCliente]
		*DESCRIPCIÓN	: CONSULTA EL CLIENTE Y EL TIPO DE PRECIO MANEJADO POR EL MISMO
		*AUTOR			: SOFTECH SISTEMAS
		**************************************************************************/
		CREATE PROCEDURE [dbo].[pv_ObtenerCliente]
(
       @sCocli             CHAR(16)            = NULL,
       @sCliDes     VARCHAR(100) = NULL,
       @sRif        VARCHAR(18)         = NULL
)
AS
IF (@sCocli = '')
       SET @sCocli = NULL

IF (@sCliDes = '')
       SET @sCliDes = NULL

IF (@sRif = '')
       SET @sRif = NULL
ELSE
       SET @sRif = dbo.PV_DevolverCedula (@sRif)

SELECT TOP 100  co_cli AS 'Codigo',
               case when inactivo =0 then ISNULL(C.cli_des,'') else rtrim(ISNULL(C.cli_des,'') + ' ' + '(INACTIVO)' ) end AS 'Descripcion',
               ISNULL(C.rif,'') 'Cedula/RIF' ,
               ISNULL(C.Telefonos,'') AS 'Telefonos',
               ISNULL(C.direc1,'') AS 'Direccion',
               TP.des_precio Precio, TP.co_precio , C.tip_cli coTipoCli ,
               TC.des_tipo Tipo_Cli, C.desc_glob
      FROM saCliente C
             INNER JOIN saTipoCliente TC ON C.tip_cli = TC.tip_cli
             INNER JOIN saTipoPrecio TP ON TC.co_precio = TP.co_precio
      WHERE
         (@sCocli IS NULL OR 
             (C.co_cli LIKE  RTRIM(LTRIM(@sCocli))+'%'))
      AND
      (@sCliDes IS NULL OR 
             (C.cli_des LIKE '%' + RTRIM(LTRIM(@sCliDes))+'%'))
      AND
         (@sRif IS NULL OR 
             (dbo.PV_DevolverCedula(C.rif) LIKE RTRIM(LTRIM(@sRif))+'%'))
      ORDER BY co_cli
RETURN
```
